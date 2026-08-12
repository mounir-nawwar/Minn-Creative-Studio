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
// Untagged video jobs are priced as the high-quality model so a missing id can
// never under-bill.
import { HQ_VIDEO_MODEL } from '../../src/lib/models.ts';
import { uploadBase64, STORAGE_PATH, PUBLIC_URL_BASE } from './storage.ts';
import { trackProjectCost, assets, generateId } from './database.ts';
import { processInlineData } from '../utils/media.ts';
import { resolveMediaUrl, type MediaBytes } from '../utils/mediaRefs.ts';
import { imageGenerationGate, QuotaWaitTooLong } from './quotaGate.ts';
import {
  VERTEX_PROJECT,
  vertexAuth,
  getVertexClient,
  sanitizeForVertex,
  vertexGenerateVideos,
  vertexGetOperation,
  vertexFetchGCS,
  vertexLyriaGenerate,
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
 * Everything the background tracker needs to price a finished operation.
 *
 * Deliberately narrow: the tracker holds this in a closure for up to ten
 * minutes, so it must not capture the request's image bytes.
 */
interface LroPricingContext {
  projectId?: string;
  _projectId?: string;
  _audioModel?: string;
  model?: string;
  config?: { numberOfVideos?: number; duration?: number; resolution?: string; audio?: boolean };
}

/**
 * Server-side background worker: polls active Veo/Lyria LRO operations to completion.
 * Guarantees that cost tracking and asset records complete even if the browser tab closes mid-generation.
 */
function registerBackgroundLroTracker(opName: string, params: LroPricingContext, via: GenerationVia = 'app') {
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
            const videoModel = params.model || HQ_VIDEO_MODEL;
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
                model: videoModel,
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
                model: params._audioModel,
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

/** The 2/min quota applies to generateContent calls that ask for an image back. */
function isImageGeneration(params: any): boolean {
  const modalities = params?.config?.responseModalities;
  return Array.isArray(modalities) && modalities.includes('IMAGE');
}

/** True for an upstream rate-limit rejection, whatever wording Google used. */
function isUpstreamRateLimit(err: any): boolean {
  return err?.status === 429 || err?.code === 429;
}

/**
 * Run a Vertex call under its quota gate.
 *
 * Waits for a slot rather than firing into an exhausted bucket, and converts
 * both outcomes — no slot available, or a 429 that got through anyway — into a
 * GenerationHttpError(429) carrying the seconds to wait. Callers must never see
 * a rate limit dressed up as a 500; that is what made the client retry it.
 */
async function callWithImageQuota<T>(signal: AbortSignal | undefined, call: () => Promise<T>): Promise<T> {
  try {
    await imageGenerationGate.acquire(signal);
  } catch (err) {
    if (err instanceof QuotaWaitTooLong) {
      throw new GenerationHttpError(429, {
        success: false,
        error: `Image generation is limited to ${process.env.VERTEX_IMAGE_RPM || 2} per minute on this Google Cloud project. Try again in ${err.retryAfterSeconds}s.`,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    }
    throw err;
  }

  try {
    return await call();
  } catch (err) {
    if (isUpstreamRateLimit(err)) {
      imageGenerationGate.penalize();
      throw new GenerationHttpError(429, {
        success: false,
        error: 'Google rejected the request as over quota (2 image generations per minute). Try again in a minute.',
        retryAfterSeconds: 60,
      });
    }
    throw err;
  }
}

/**
 * Resolve `{ _imageUrl }` references to bytes, just before the Vertex call.
 *
 * Callers send a *reference* whenever the server can obtain the file itself —
 * a Library asset is read off disk rather than uploaded back to the machine
 * already storing it. Only genuinely local media (`data:` / `blob:`) is
 * inlined by the caller, because nobody else can see it.
 *
 * An unresolvable reference throws. The previous implementation swallowed the
 * error and passed the unresolved marker through, so Vertex received a part
 * with no image in it and the request quietly produced the wrong thing.
 */
async function resolveRef(url: string): Promise<MediaBytes> {
  try {
    return await resolveMediaUrl(url);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new GenerationHttpError(422, { success: false, error: `Unresolvable media reference: ${detail}` });
  }
}

/** `{ _imageUrl }` → `{ imageBytes, mimeType }` for the video APIs; anything else passes through. */
async function resolveImageField(field: any): Promise<any> {
  if (!field?._imageUrl) return field;
  const { data, mimeType } = await resolveRef(field._imageUrl);
  return { imageBytes: data, mimeType };
}

/** `{ _imageUrl }` → `{ inlineData }` for generateContent parts. */
async function resolveParts(parts: any[]): Promise<any[]> {
  return Promise.all(parts.map(async (part: any) => {
    if (!part?._imageUrl) return part;
    const { data, mimeType } = await resolveRef(part._imageUrl);
    return { inlineData: { data, mimeType } };
  }));
}

async function resolveMediaRefs(method: GenerationMethod, params: any): Promise<any> {
  if (method === 'generateContent') {
    const { contents } = params;
    if (!contents) return params;
    if (Array.isArray(contents)) {
      return {
        ...params,
        contents: await Promise.all(contents.map(async (c: any) =>
          c?.parts ? { ...c, parts: await resolveParts(c.parts) } : c
        )),
      };
    }
    if (contents.parts) {
      return { ...params, contents: { ...contents, parts: await resolveParts(contents.parts) } };
    }
    return params;
  }

  if (method === 'generateVideos') {
    const config = params.config;
    return {
      ...params,
      image: await resolveImageField(params.image),
      ...(config && {
        config: {
          ...config,
          ...(config.lastFrame && { lastFrame: await resolveImageField(config.lastFrame) }),
          ...(Array.isArray(config.referenceImages) && {
            referenceImages: await Promise.all(config.referenceImages.map(async (ref: any) => ({
              ...ref,
              image: await resolveImageField(ref.image),
            }))),
          }),
        },
      }),
    };
  }

  return params;
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
    params = await resolveMediaRefs(method, params);
    if (USE_VERTEX_AI) params = sanitizeForVertex(params);
    const { projectId, ...sdkParams } = params;

    let response;
    if (USE_VERTEX_AI && sdkParams.model?.includes('lyria')) {
      // Both Lyria Clip and Pro resolve synchronously through the global
      // /interactions API — the old regional :predict / predictLongRunning
      // paths 404. Billing is flat per generation (no usage metadata).
      response = await vertexLyriaGenerate(sdkParams);

      if (projectId) {
        const cost = calculateCost(sdkParams.model, {});
        if (cost > 0) {
          await trackProjectCost(projectId, cost, { type: 'audio', audioCount: 1, model: sdkParams.model, via });
        }
      }
    } else if (isImageGeneration(sdkParams)) {
      response = await callWithImageQuota(signal, () => ai(sdkParams.model).models.generateContent(sdkParams));
    } else {
      response = await ai(sdkParams.model).models.generateContent(sdkParams);
    }

    const candidates = (response as any).candidates ?? [];
    const generatedImages = candidates.flatMap((c: any) =>
      (c?.content?.parts ?? []).filter((p: any) => p.inlineData && p.inlineData.mimeType?.startsWith('image/'))
    );
    const imageCount = generatedImages.length;
    const usageMetadata = (response as any).usageMetadata;

    // Every field Vertex reports is forwarded verbatim — the cost calculator
    // needs the modality split and the separately-reported reasoning tokens,
    // not just the flat candidate count.
    const usage = usageMetadata ? {
      promptTokenCount: usageMetadata.promptTokenCount,
      candidatesTokenCount: usageMetadata.candidatesTokenCount,
      totalTokenCount: usageMetadata.totalTokenCount,
      thoughtsTokenCount: usageMetadata.thoughtsTokenCount,
      cachedContentTokenCount: usageMetadata.cachedContentTokenCount,
      promptTokensDetails: usageMetadata.promptTokensDetails,
      candidatesTokensDetails: usageMetadata.candidatesTokensDetails,
      imageCount,
    } : null;

    // Usage log
    if (usageMetadata) {
      const detail = (usageMetadata.candidatesTokensDetails ?? [])
        .map((d: any) => `${d.modality}:${d.tokenCount}`).join(' ');
      console.log(`[Usage] model=${sdkParams.model} projectId=${projectId ?? 'none'} images=${imageCount} | in=${usageMetadata.promptTokenCount} out=${usageMetadata.candidatesTokenCount}${detail ? ` [${detail}]` : ''}${usageMetadata.thoughtsTokenCount ? ` thoughts=${usageMetadata.thoughtsTokenCount}` : ''} total=${usageMetadata.totalTokenCount}`);
    } else {
      console.log(`[Usage] model=${sdkParams.model} projectId=${projectId ?? 'none'} images=${imageCount} | no usageMetadata`);
    }

    // Track image generation costs
    if (imageCount > 0 && projectId && usage) {
      const cost = calculateCost(sdkParams.model, usage);
      if (cost > 0) {
        await trackProjectCost(projectId, cost, {
          type: 'image',
          imageCount,
          tokenCount: usageMetadata.totalTokenCount || 0,
          model: sdkParams.model,
          via,
        });
      }
    }

    // Track TTS and text costs — both are ordinary token billing.
    if (!imageCount && projectId && usage) {
      const isTts = !!sdkParams.model?.includes('tts');
      const cost = calculateCost(sdkParams.model, usage);
      if (cost > 0) {
        await trackProjectCost(projectId, cost, {
          type: isTts ? 'audio' : 'text',
          ...(isTts ? { audioCount: 1 } : {}),
          tokenCount: usageMetadata.totalTokenCount || 0,
          model: sdkParams.model,
          via,
        });
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

  // NOTE: the 'generateImages' method (the Imagen-only SDK call) was removed —
  // Imagen 404s on this Vertex project and every caller now uses generateContent.

  // Video: @google/genai SDK hardcodes v1beta — use v1 REST directly via vertexGenerateVideos
  if (method === 'generateVideos') {
    params = await resolveMediaRefs(method, params);
    const result = USE_VERTEX_AI
      ? await vertexGenerateVideos(params)
      : await devAi!.models.generateVideos(params);
    
    const opName = typeof result === 'string' ? result : (result?.name || result?.operation?.name);
    if (opName) {
      // Pass only the pricing fields — `params` now carries resolved image
      // bytes, and the tracker keeps its argument alive for up to ten minutes.
      const { projectId, _projectId, _audioModel, model, config } = params;
      registerBackgroundLroTracker(opName, {
        projectId, _projectId, _audioModel, model,
        config: config && {
          numberOfVideos: config.numberOfVideos,
          duration: config.duration,
          resolution: config.resolution,
          audio: config.audio,
        },
      }, via);
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
        const videoModel = model || HQ_VIDEO_MODEL;
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
            model: videoModel,
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
            model: _audioModel,
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
