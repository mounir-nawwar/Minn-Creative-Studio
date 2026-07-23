/**
 * Generation service — the single Vertex AI execution path.
 *
 * Extracted verbatim from the POST /api/gemini/proxy route so that both the
 * HTTP proxy (the app) and the MCP connector call the SAME code: cost
 * tracking, storage upload of generated media, asset rows, and LRO handling
 * all live here exactly once. `via` marks who initiated the generation
 * ('app' = the studio frontend, 'mcp' = Claude through the connector) and is
 * threaded into usage-log and asset metadata.
 *
 * Contract: resolves with the `data` payload the proxy used to wrap in
 * `{ success: true, data }`. Expected HTTP-mappable failures throw
 * `GenerationHttpError` carrying the exact status + JSON body the route
 * previously produced; anything else propagates as-is.
 */

import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { GoogleGenAI } from '@google/genai';
import { calculateCost } from '../config/pricing.ts';
import { uploadBase64, STORAGE_PATH, PUBLIC_URL_BASE } from './storage.ts';
import { trackProjectCost, assets, generateId } from './database.ts';
import { resolveImageUrls, processInlineData } from '../utils/media.ts';
import {
  VERTEX_PROJECT,
  vertexAuth,
  getVertexClient,
  sanitizeForVertex,
  vertexGenerateVideos,
  vertexGetOperation,
  vertexFetchGCS,
  vertexPredict,
  vertexRest,
} from './vertex.ts';
import * as fs from 'fs';
import * as path from 'path';

// Always use Vertex AI for all AI calls
const USE_VERTEX_AI = true;

/** Dedup guard so an LRO's cost is tracked once across repeated polls (max 1000 items). */
const MAX_TRACKED_OPERATIONS = 1000;
const trackedOperations = new Set<string>();

function markOperationTracked(opName: string): boolean {
  if (!opName) return false;
  if (trackedOperations.has(opName)) return false;
  if (trackedOperations.size >= MAX_TRACKED_OPERATIONS) {
    const oldest = trackedOperations.keys().next().value;
    if (oldest) trackedOperations.delete(oldest);
  }
  trackedOperations.add(opName);
  return true;
}

/**
 * Server-side background worker: polls active Veo/Lyria LRO operations to completion.
 * Guarantees that cost tracking and asset records complete even if the browser tab closes mid-generation.
 */
function registerBackgroundLroTracker(opName: string, params: any, via: GenerationVia = 'app') {
  if (!opName || trackedOperations.has(opName)) return;

  const POLL_INTERVAL = 5000;
  const MAX_POLLS = 120; // 10 minutes max
  let polls = 0;

  const interval = setInterval(async () => {
    polls++;
    if (polls > MAX_POLLS || trackedOperations.has(opName)) {
      clearInterval(interval);
      return;
    }

    try {
      const result = await vertexGetOperation(opName);
      if (result?.done) {
        clearInterval(interval);
        if (markOperationTracked(opName)) {
          const effectiveProjectId = params.projectId || params._projectId;
          const isAudioOp = params._audioModel?.includes('lyria');
          const isVideoOp = !isAudioOp && (params._audioModel?.includes('veo') || !params.model?.includes('lyria'));

          if (effectiveProjectId && isVideoOp) {
            const videoModel = params.model || 'veo-3.1-generate-001';
            const videoCount = result?.response?.generatedVideos?.length || params.config?.numberOfVideos || 1;
            const costPerVideo = calculateCost(videoModel, {}, {
              duration: params.config?.duration,
              resolution: params.config?.resolution,
              audio: params.config?.audio,
            });
            const videoCost = costPerVideo * videoCount;
            if (videoCost > 0) {
              await trackProjectCost(effectiveProjectId, videoCost, {
                type: 'video',
                videoCount,
                via,
              });
            }
          }

          if (effectiveProjectId && isAudioOp && params._audioModel) {
            const audioCost = calculateCost(params._audioModel, {});
            if (audioCost > 0) {
              await trackProjectCost(effectiveProjectId, audioCost, {
                type: 'audio',
                audioCount: 1,
                via,
              });
            }
          }
        }
      }
    } catch (err) {
      // quiet retry on background poll
    }
  }, POLL_INTERVAL);
}

export type GenerationMethod =
  | 'generateContent'
  | 'generateImages'
  | 'generateVideos'
  | 'getOperation'
  | 'fetchVideoFile';

export type GenerationVia = 'app' | 'mcp';

export class GenerationHttpError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super(typeof payload.error === 'string' ? payload.error : `HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

export interface RunGenerationArgs {
  method: GenerationMethod;
  params: any;
  userId: string;
  signal?: AbortSignal;
  via?: GenerationVia;
}

/**
 * Upload generated inline data to local storage
 */
async function uploadInlineDataToStorage(
  parts: any[],
  projectId: string,
  userId: string,
  via?: GenerationVia
): Promise<any[]> {
  return Promise.all(parts.map(async (part: any, i: number) => {
    if (!part.inlineData?.data) return part;

    const { data, mimeType } = part.inlineData;
    const { buffer, mimeType: processedMimeType, extension } = processInlineData(data, mimeType);

    const filename = `${Date.now()}-${i}-generated.${extension}`;
    const result = await uploadBase64(projectId, userId, {
      base64: data,
      mimeType: processedMimeType,
      filename
    }, via === 'mcp' ? { metadata: { via: 'mcp' } } : undefined);

    console.log(`[Upload] ${Math.round(buffer.byteLength / 1024)}KB → ${result.url}`);
    return { ...part, inlineData: { storageUrl: result.url, mimeType: processedMimeType } };
  }));
}

export async function runGeneration({ method, params: incomingParams, userId, signal, via }: RunGenerationArgs): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!USE_VERTEX_AI && !apiKey) {
    throw new GenerationHttpError(500, { error: 'API key not configured' });
  }

  let params = incomingParams;
  const devAi = !USE_VERTEX_AI ? new GoogleGenAI({ apiKey: apiKey! }) : null;
  const ai = (model: string) => USE_VERTEX_AI ? getVertexClient(model) : devAi!;

  if (method === 'generateContent') {
    if (params?.contents) params = { ...params, contents: await resolveImageUrls(params.contents) };
    if (USE_VERTEX_AI) params = sanitizeForVertex(params);
    const { projectId, ...sdkParams } = params;

    let response;
    if (USE_VERTEX_AI && sdkParams.model?.includes('lyria')) {
      if (sdkParams.model.includes('pro')) {
        // Lyria Pro requires Long-Running Prediction
        const { model, contents, config = {} } = sdkParams;
        const parts = Array.isArray(contents) ? contents[0]?.parts : contents?.parts;
        const instance: any = { prompt: parts.find((p: any) => p.text)?.text };
        const refs = parts
          .filter((p: any) => p.inlineData)
          .map((p: any) => ({ bytesBase64Encoded: p.inlineData.data, mimeType: p.inlineData.mimeType }));
        if (refs.length > 0) instance.reference_images = refs;
        if (config.negative_prompt) instance.negative_prompt = config.negative_prompt;
        if (config.seed !== undefined) instance.seed = config.seed;
        if (config.duration) instance.duration = config.duration;
        if (config.guidance !== undefined) instance.guidance = config.guidance;
        if (config.bpm !== undefined) instance.bpm = config.bpm;
        if (config.density !== undefined) instance.density = config.density;
        if (config.brightness !== undefined) instance.brightness = config.brightness;
        if (config.scale) instance.scale = config.scale;
        const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/us-central1/publishers/google/models/${model}:predictLongRunning`;
        const op = await vertexRest(url, 'POST', { instances: [instance], parameters: { sampleCount: 1 } });
        if (op?.name) {
          registerBackgroundLroTracker(op.name, { ...params, _audioModel: sdkParams.model, _projectId: projectId }, via);
        }

        // Context for cost tracking when the operation completes (getOperation)
        return {
          operation: op.name,
          isLro: true,
          _audioModel: sdkParams.model,
          _projectId: projectId,
        };
      } else {
        response = await vertexPredict(sdkParams);

        // Track cost for non-pro audio immediately
        if (projectId) {
          const cost = calculateCost(sdkParams.model, {});
          if (cost > 0) {
            await trackProjectCost(projectId, cost, { type: 'audio', audioCount: 1, via });
          }
        }
      }
    } else {
      response = await ai(sdkParams.model).models.generateContent(sdkParams);
    }

    const candidates = (response as any).candidates ?? [];
    const generatedImages = candidates.flatMap((c: any) =>
      (c?.content?.parts ?? []).filter((p: any) => p.inlineData && p.inlineData.mimeType?.startsWith('image/'))
    );
    const imageCount = generatedImages.length;
    const usageMetadata = (response as any).usageMetadata;

    // Usage log
    if (usageMetadata) {
      const thinking = (usageMetadata.totalTokenCount || 0) - (usageMetadata.promptTokenCount || 0) - (usageMetadata.candidatesTokenCount || 0);
      console.log(`[Usage] model=${sdkParams.model} projectId=${projectId ?? 'none'} images=${imageCount} | in=${usageMetadata.promptTokenCount} out=${usageMetadata.candidatesTokenCount}${thinking > 0 ? ` thinking=${thinking}` : ''} total=${usageMetadata.totalTokenCount}`);
    } else {
      console.log(`[Usage] model=${sdkParams.model} projectId=${projectId ?? 'none'} images=${imageCount} | no usageMetadata`);
    }

    // Track image generation costs
    if (imageCount > 0 && projectId && usageMetadata) {
      const cost = calculateCost(sdkParams.model, {
        promptTokenCount: usageMetadata.promptTokenCount,
        candidatesTokenCount: usageMetadata.candidatesTokenCount,
        imageCount,
      });
      if (cost > 0) {
        await trackProjectCost(projectId, cost, {
          type: 'image',
          imageCount,
          tokenCount: usageMetadata.totalTokenCount || 0,
          via,
        });
      }
    }

    // Track TTS and text costs
    if (!imageCount && projectId) {
      if (sdkParams.model?.includes('tts')) {
        // TTS: billed per input character
        const allParts = Array.isArray(sdkParams.contents)
          ? sdkParams.contents.flatMap((c: any) => c?.parts ?? [])
          : (sdkParams.contents?.parts ?? []);
        const charCount = allParts
          .filter((p: any) => typeof p.text === 'string')
          .reduce((sum: number, p: any) => sum + p.text.length, 0);
        if (charCount > 0) {
          const cost = calculateCost(sdkParams.model, { characterCount: charCount });
          if (cost > 0) await trackProjectCost(projectId, cost, { type: 'audio', audioCount: 1, via });
        }
      } else if (usageMetadata) {
        // All other text/chat models: input + output tokens
        const cost = calculateCost(sdkParams.model, {
          promptTokenCount: usageMetadata.promptTokenCount,
          candidatesTokenCount: usageMetadata.candidatesTokenCount,
        });
        if (cost > 0) {
          await trackProjectCost(projectId, cost, {
            type: 'text',
            tokenCount: usageMetadata.totalTokenCount || 0,
            via,
          });
        }
      }
    }

    // Upload inline data to local storage
    if (projectId) {
      for (const c of candidates) {
        if (c?.content?.parts) {
          c.content.parts = await uploadInlineDataToStorage(c.content.parts, projectId, userId, via);
        }
      }
    }

    const text = candidates
      .flatMap((c: any) => (c?.content?.parts ?? []).filter((p: any) => p.text).map((p: any) => p.text))
      .join('');
    const promptBlock = (response as any).promptFeedback?.blockReason;
    const hasImage = candidates.some((c: any) => c?.content?.parts?.some((p: any) => p.inlineData));
    if (promptBlock && !hasImage) {
      throw new GenerationHttpError(422, { success: false, error: `Prompt blocked: ${promptBlock}` });
    }
    return { candidates, text, promptFeedback: (response as any).promptFeedback || {} };
  }

  if (method === 'generateImages') {
    const { projectId, ...sdkParams } = params;
    console.log('[generateImages] projectId:', projectId, 'model:', sdkParams.model);
    const genData = await ai(sdkParams.model).models.generateImages(sdkParams);
    const imageCount = genData.generatedImages?.length || 1;

    const cost = calculateCost(sdkParams.model, {}, { numberOfImages: imageCount, sampleCount: sdkParams.config?.numberOfImages || 1 });
    if (cost > 0 && projectId) {
      await trackProjectCost(projectId, cost, { type: 'image', imageCount, via });
    }

    // Upload generated images to local storage
    if (projectId) {
      for (const img of (genData.generatedImages ?? [])) {
        if (img.image?.imageBytes) {
          try {
            const result = await uploadBase64(projectId, userId, {
              base64: img.image.imageBytes,
              mimeType: 'image/png',
              filename: `${Date.now()}-generated.png`
            }, via === 'mcp' ? { metadata: { via: 'mcp' } } : undefined);
            (img.image as any).storageUrl = result.url;
            console.log(`[Upload] Imagen ${Math.round(Buffer.from(img.image.imageBytes, 'base64').byteLength / 1024)}KB → ${result.url}`);
            delete img.image.imageBytes;
          } catch (e) {
            console.error('Storage upload failed:', e);
          }
        }
      }
    }
    return genData;
  }

  // Video: @google/genai SDK hardcodes v1beta — use v1 REST directly via vertexGenerateVideos
  if (method === 'generateVideos') {
    const result = USE_VERTEX_AI
      ? await vertexGenerateVideos(params)
      : await devAi!.models.generateVideos(params);
    
    const opName = typeof result === 'string' ? result : (result?.name || result?.operation?.name);
    if (opName) {
      registerBackgroundLroTracker(opName, params, via);
    }

    // Cost is tracked in getOperation when done — avoids double-counting the LRO
    return result;
  }

  if (method === 'getOperation') {
    const { projectId, model, config, operation: opParam, _audioModel, _projectId } = params;
    const opName = typeof opParam === 'string' ? opParam : opParam?.name;
    const result = USE_VERTEX_AI
      ? await vertexGetOperation(opParam ?? params)
      : await devAi!.operations.getVideosOperation(params);

    const effectiveProjectId = projectId || _projectId;
    const isAudioOp = _audioModel?.includes('lyria');
    const isVideoOp = !isAudioOp && (_audioModel?.includes('veo') || !model?.includes('lyria'));

    if (result?.done && effectiveProjectId && opName && markOperationTracked(opName)) {
      // Video cost tracking
      if (isVideoOp) {
        const videoModel = model || 'veo-3.1-generate-001';
        const videoCount = result?.response?.generatedVideos?.length || config?.numberOfVideos || 1;
        const costPerVideo = calculateCost(videoModel, {}, {
          duration: config?.duration,
          resolution: config?.resolution,
          audio: config?.audio,
        });
        const videoCost = costPerVideo * videoCount;
        if (videoCost > 0) {
          await trackProjectCost(effectiveProjectId, videoCost, {
            type: 'video',
            videoCount,
            via,
          });
        }
      }

      // Audio cost tracking (Lyria Pro)
      if (isAudioOp && _audioModel) {
        const audioCost = calculateCost(_audioModel, {});
        if (audioCost > 0) {
          await trackProjectCost(effectiveProjectId, audioCost, {
            type: 'audio',
            audioCount: 1,
            via,
          });
        }
      }
    }
    return result;
  }

  if (method === 'fetchVideoFile') {
    const { url, projectId } = params;

    // Stream directly to local storage when projectId is available
    if (projectId) {
      try {
        const projectDir = path.join(STORAGE_PATH, 'projects', projectId, 'videos');
        if (!fs.existsSync(projectDir)) {
          fs.mkdirSync(projectDir, { recursive: true });
        }

        const filename = `${Date.now()}-generated-video.mp4`;
        const storagePath = path.join(projectDir, filename);
        const relativePath = path.relative(STORAGE_PATH, storagePath);
        const publicUrl = `${PUBLIC_URL_BASE}/${relativePath.replace(/\\/g, '/')}`;

        // Record the video in the assets table so asset queries (grid, Library) can see it
        const recordVideoAsset = (mimeType: string, sizeBytes: number): string => {
          const assetId = generateId();
          assets.create(assetId, projectId, userId, {
            type: 'video',
            filename,
            storagePath: relativePath.replace(/\\/g, '/'),
            url: publicUrl,
            mimeType,
            sizeBytes,
            ...(via === 'mcp' ? { metadata: { via: 'mcp' } } : {}),
          });
          return assetId;
        };

        let contentType: string;
        let resStream: any;

        if (url?.startsWith('data:')) {
          const [header, b64] = url.split(',');
          contentType = header.split(':')[1]?.split(';')[0] || 'video/mp4';
          const buf = Buffer.from(b64, 'base64');
          fs.writeFileSync(storagePath, buf);
          const assetId = recordVideoAsset(contentType, buf.byteLength);
          console.log(`[Veo] Saved ${Math.round(buf.byteLength / 1024)}KB → ${publicUrl}`);
          return { storageUrl: publicUrl, assetId };
        }

        if (USE_VERTEX_AI && url?.startsWith('gs://')) {
          const withoutScheme = url.replace('gs://', '');
          const slashIdx = withoutScheme.indexOf('/');
          const b = withoutScheme.slice(0, slashIdx);
          const o = encodeURIComponent(withoutScheme.slice(slashIdx + 1));
          const token = await vertexAuth.getAccessToken();
          const fetchUrl = `https://storage.googleapis.com/download/storage/v1/b/${b}/o/${o}?alt=media`;
          console.log(`[Veo] Streaming from GCS: ${url}`);
          const r = await fetch(fetchUrl, { headers: { 'Authorization': `Bearer ${token}` }, signal });
          if (!r.ok) throw new Error(`GCS fetch failed: ${r.status}`);
          contentType = r.headers.get('content-type') || 'video/mp4';
          resStream = r.body;
        } else {
          const headers: Record<string, string> = {};
          if (apiKey) headers['x-goog-api-key'] = apiKey;
          console.log(`[Veo] Streaming from HTTP: ${url}`);
          const r = await fetch(url, { headers, signal });
          if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
          contentType = r.headers.get('content-type') || 'video/mp4';
          resStream = r.body;
        }

        if (resStream) {
          const writeStream = fs.createWriteStream(storagePath);
          await pipeline(Readable.fromWeb(resStream), writeStream);
          const sizeBytes = fs.statSync(storagePath).size;
          const assetId = recordVideoAsset(contentType, sizeBytes);
          console.log(`[Veo] Streamed to Storage: ${publicUrl}`);
          return { storageUrl: publicUrl, assetId };
        }
      } catch (uploadErr: any) {
        console.error('[Veo] Streaming upload failed:', uploadErr.message);
        if (uploadErr.name === 'AbortError') {
          throw new GenerationHttpError(504, { success: false, error: 'Request timed out during video transfer.' });
        }
        throw uploadErr;
      }
    }

    // Legacy non-streaming fallback (no projectId)
    let base64: string;
    let contentType: string;
    if (url?.startsWith('data:')) {
      const [header, b64] = url.split(',');
      contentType = header.split(':')[1]?.split(';')[0] || 'video/mp4';
      base64 = b64;
    } else if (USE_VERTEX_AI && url?.startsWith('gs://')) {
      ({ base64, contentType } = await vertexFetchGCS(url));
    } else {
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-goog-api-key'] = apiKey;
      const r = await fetch(url, { headers, signal });
      base64 = Buffer.from(await r.arrayBuffer()).toString('base64');
      contentType = r.headers.get('content-type') || 'video/mp4';
    }
    return { base64, contentType };
  }

  throw new GenerationHttpError(400, { error: `Unknown method: ${method}` });
}
