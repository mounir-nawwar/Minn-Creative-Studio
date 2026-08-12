import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import { addWavHeader } from '../utils/audio.ts';

function getVertexProjectId(): string {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    if (process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required in production');
    }
    const devProjectId = process.env.VERTEX_DEV_PROJECT;
    if (!devProjectId) {
      console.warn('⚠️  GOOGLE_CLOUD_PROJECT not set. Vertex AI features will not work.');
      console.warn('   Set GOOGLE_CLOUD_PROJECT or VERTEX_DEV_PROJECT for local development.');
      return '';
    }
    return devProjectId;
  }
  return projectId;
}

export const VERTEX_PROJECT = getVertexProjectId();
if (VERTEX_PROJECT) {
  console.log(`[Vertex] Active Project: ${VERTEX_PROJECT}`);
} else {
  console.warn('[Vertex] No project configured - Vertex AI features disabled');
}

/**
 * Regional endpoint for models not served globally (currently TTS).
 *
 * europe-west3 (Frankfurt) — the team is in Beirut, so a European region is a
 * shorter round-trip than the previous us-central1. Text and image use the
 * `global` endpoint and are unaffected.
 */
export const VERTEX_REGION = process.env.GOOGLE_CLOUD_REGION || 'europe-west3';

/**
 * Veo has its own region, and it is deliberately NOT the one above.
 *
 * Veo 3.x rollout is effectively us-central1-only; Frankfurt carries Veo 2.
 * A `:predictLongRunning` probe answers 400 for veo-3.1 in europe-west3, but
 * that only proves the request shape was validated — it is not evidence the
 * project can run the model there. Moving video on that basis would risk
 * breaking it for a latency gain that barely matters on a job taking minutes.
 * Override with VEO_REGION if Google's availability changes.
 */
export const VEO_REGION = process.env.VEO_REGION || 'us-central1';

/** Base URL for a regional Vertex publisher model. */
function regionalModelUrl(model: string, verb: string, region = VERTEX_REGION): string {
  return `https://${region}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${region}/publishers/google/models/${model}:${verb}`;
}

export const vertexAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

// Direct Vertex AI v1 REST — bypasses @google/genai SDK which is hardcoded to v1beta for video
export async function vertexRest(url: string, method = 'GET', body?: any) {
  const token = await vertexAuth.getAccessToken();
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    // Carry the HTTP status. Without it a Veo/Lyria rate limit reaches the
    // route as a shapeless Error, gets reported as 500, and the browser retries
    // it into the exhausted quota — the SDK path sets `status`, so this one must
    // too or the two paths behave differently for the same failure.
    throw Object.assign(new Error(text), { status: res.status });
  }
  return JSON.parse(text);
}

const vertexClients: Record<string, GoogleGenAI> = {};

export function getVertexClient(model = ''): GoogleGenAI {
  const isVideo = /^veo-/.test(model);
  const needsRegionalEndpoint = isVideo || /^imagen-/.test(model) || model.includes('tts') || model.includes('lyra') || model.includes('audio');
  const location = isVideo ? VEO_REGION : needsRegionalEndpoint ? VERTEX_REGION : 'global';
  if (!vertexClients[location]) {
    vertexClients[location] = new GoogleGenAI({ vertexai: true, project: VERTEX_PROJECT, location });
  }
  return vertexClients[location];
}

// Vertex AI only accepts role 'user'|'model' — normalize roles and extract system prompts
export function sanitizeForVertex(params: any): any {
  if (!params.contents) return params;
  if (typeof params.contents === 'string') {
    return { ...params, contents: [{ role: 'user', parts: [{ text: params.contents }] }] };
  }
  const arr: any[] = Array.isArray(params.contents) ? params.contents : [params.contents];
  const systemParts = arr.filter((c: any) => c?.role === 'system').flatMap((c: any) => c?.parts ?? []);
  const sanitized = arr
    .filter((c: any) => c?.role !== 'system')
    .map((c: any) => ({ ...c, role: c.role === 'assistant' ? 'model' : (c.role || 'user') }));
  const result: any = { ...params, contents: sanitized };
  if (systemParts.length > 0) {
    const systemText = systemParts.map((p: any) => p.text ?? '').join('\n');
    const existing = result.config?.systemInstruction;
    result.config = {
      ...result.config,
      systemInstruction: existing
        ? `${typeof existing === 'string' ? existing : existing?.parts?.[0]?.text ?? ''}\n${systemText}`
        : systemText,
    };
  }
  return result;
}

export async function vertexGenerateVideos(params: any) {
  const { model, prompt, image, config = {} } = params;
  const instance: any = { prompt: prompt || 'Animate this' };
  if (image?.imageBytes) {
    instance.image = {
      bytesBase64Encoded: image.imageBytes,
      mimeType: image.mimeType || 'image/jpeg',
      ...(config.resizeMode && { resizeMode: config.resizeMode }),
    };
  }
  if (config.lastFrame?.imageBytes) {
    instance.lastFrame = { bytesBase64Encoded: config.lastFrame.imageBytes, mimeType: config.lastFrame.mimeType || 'image/jpeg' };
  }
  // Reference images were being built by every caller and then dropped here.
  // Shape per the SDK's own Vertex converter (videoGenerationReferenceImageToVertex):
  // instances[0].referenceImages[] = { image: { bytesBase64Encoded, mimeType }, referenceType }.
  // Veo accepts only ASSET and STYLE, while the canvas offers five roles — 'style'
  // maps to STYLE and every other role describes something that should appear, i.e. ASSET.
  const referenceImages = (config.referenceImages || [])
    .filter((ref: any) => ref?.image?.imageBytes)
    .map((ref: any) => ({
      image: {
        bytesBase64Encoded: ref.image.imageBytes,
        mimeType: ref.image.mimeType || 'image/jpeg',
      },
      referenceType: String(ref.referenceType || ref.role || 'asset').toUpperCase() === 'STYLE' ? 'STYLE' : 'ASSET',
    }));
  if (referenceImages.length > 0) {
    instance.referenceImages = referenceImages;
  }
  const parameters: any = {
    aspectRatio: config.aspectRatio || '16:9',
    sampleCount: Math.min(Math.max(config.sampleCount || 1, 1), 4),
    durationSeconds: config.duration || 8,
  };
  if (config.resolution) parameters.resolution = config.resolution;
  if (config.negativePrompt) parameters.negativePrompt = config.negativePrompt;
  if (config.seed !== undefined) parameters.seed = config.seed;
  if (config.personGeneration) parameters.personGeneration = config.personGeneration;
  if (config.audio !== undefined) parameters.enableNativeAudio = config.audio;
  // Log the instance by shape, never by content — it holds megabytes of base64.
  const inputs = [
    instance.image && 'startFrame',
    instance.lastFrame && 'lastFrame',
    referenceImages.length > 0 && `${referenceImages.length} reference(s)`,
  ].filter(Boolean);
  console.log('[Veo] Sending parameters:', JSON.stringify(parameters), '| inputs:', inputs.join(', ') || 'none');
  const op = await vertexRest(regionalModelUrl(model, 'predictLongRunning', VEO_REGION), 'POST', { instances: [instance], parameters });
  // Return in SDK-compatible shape so geminiService.ts polling loop works unchanged
  return { name: op.name, done: false };
}

export async function vertexGetOperation(operation: any) {
  const name = typeof operation === 'string' ? operation : operation?.name;
  // Must poll via fetchPredictOperation POST — plain GET returns 404
  const modelMatch = name?.match(/publishers\/google\/models\/([^/]+)\/operations\//);
  const model = modelMatch?.[1];
  if (!model) throw new Error(`Cannot extract model from operation name: ${name}`);
  // Poll where the job was started, not where we would start one now — the
  // operation name carries its own location, so jobs in flight across a region
  // change (or started by another deployment) keep resolving correctly.
  const region = name.match(/locations\/([^/]+)\//)?.[1] || VERTEX_REGION;
  const op = await vertexRest(regionalModelUrl(model, 'fetchPredictOperation', region), 'POST', { operationName: name });
  if (!op.done) return { name: op.name ?? name, done: false };
  console.log('[Veo] Operation done. Full op keys:', Object.keys(op));
  console.log('[Veo] Raw response:', JSON.stringify(op.response ?? op, null, 2));
  // Cover all known response shapes from Vertex AI video/audio generation
  const samples =
    op.response?.videos
    ?? op.response?.audioSamples
    ?? op.response?.predictions
    ?? op.response?.generateVideoResponse?.generatedSamples
    ?? op.response?.generatedSamples
    ?? op.predictions
    ?? [];

  console.log('[Vertex LRO] Samples count:', samples.length);

  const results = await Promise.all(samples.map(async (s: any) => {
    const videoUri = s?.video?.uri ?? s?.gcsUri;
    if (videoUri) return { video: { uri: videoUri, mimeType: s?.video?.mimeType || 'video/mp4' } };
    const audioData = s?.bytesBase64Encoded || s?.audio?.bytesBase64Encoded;
    if (audioData) {
      let data = audioData;
      let mimeType = s?.mimeType || s?.audio?.mimeType || 'audio/wav';
      if (mimeType.includes('audio/l16') || model.includes('lyria')) {
        const buf = Buffer.from(data, 'base64');
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        const wavBuf = addWavHeader(buf, sampleRate);
        data = wavBuf.toString('base64');
        mimeType = 'audio/wav';
      }
      return { content: { parts: [{ inlineData: { data, mimeType } }] } };
    }
    return null;
  }));

  const filteredResults = results.filter(Boolean);
  return {
    name: op.name ?? name,
    done: true,
    response: {
      generatedVideos: filteredResults.filter((r: any) => r.video),
      candidates: filteredResults.filter((r: any) => r.content),
    },
  };
}

export async function vertexFetchGCS(gcsUri: string) {
  const withoutScheme = gcsUri.replace('gs://', '');
  const slashIdx = withoutScheme.indexOf('/');
  const bucket = withoutScheme.slice(0, slashIdx);
  const object = encodeURIComponent(withoutScheme.slice(slashIdx + 1));
  const token = await vertexAuth.getAccessToken();
  const res = await fetch(`https://storage.googleapis.com/download/storage/v1/b/${bucket}/o/${object}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GCS fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return { base64: Buffer.from(buf).toString('base64'), contentType: res.headers.get('content-type') || 'video/mp4' };
}

/**
 * Lyria 3 music generation.
 *
 * Lyria 3 is NOT served by `:predict` in a regional endpoint — that 404s. It's
 * exposed only through the global `/interactions` API, which returns the
 * finished song synchronously (measured: ~14s for a clip, ~36s for Pro), so no
 * long-running-operation polling is needed.
 *
 * Response shape:
 *   { status: 'completed', outputs: [
 *       { type: 'text',  text: '<lyrics>' },
 *       { type: 'text',  text: 'Caption: ...' },
 *       { type: 'audio', mime_type: 'audio/mpeg', data: '<base64 mp3>' } ] }
 *
 * Normalised here into the same `{ candidates: [...] }` shape the rest of the
 * pipeline expects from vertexPredict.
 */
export async function vertexLyriaGenerate(params: any) {
  const { model, contents } = params;
  const parts = Array.isArray(contents) ? contents[0]?.parts : contents?.parts;

  const input: any[] = [];
  const promptText = parts?.find((p: any) => p.text)?.text;
  if (promptText) input.push({ type: 'text', text: promptText });
  for (const p of parts ?? []) {
    if (p.inlineData) {
      input.push({ type: 'image', mime_type: p.inlineData.mimeType, data: p.inlineData.data });
    }
  }

  const url = `https://aiplatform.googleapis.com/v1beta1/projects/${VERTEX_PROJECT}/locations/global/interactions`;
  const result = await vertexRest(url, 'POST', { model, input });

  const outputs: any[] = result?.outputs ?? [];
  const audio = outputs.find((o) => o.type === 'audio');
  if (!audio?.data) {
    throw new Error(`Lyria returned no audio (status=${result?.status ?? 'unknown'})`);
  }
  const texts = outputs.filter((o) => o.type === 'text').map((o) => o.text);
  console.log(`[Lyria] ${model} → ${Math.round((audio.data.length * 0.75) / 1024)}KB ${audio.mime_type || 'audio/mpeg'}`);

  return {
    candidates: [{
      content: { parts: [{ inlineData: { data: audio.data, mimeType: audio.mime_type || 'audio/mpeg' } }] },
    }],
    // Lyria also returns the lyrics and a description of what it composed.
    lyriaLyrics: texts[0],
    lyriaCaption: texts[1],
  };
}

