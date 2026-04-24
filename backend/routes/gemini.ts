import express from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '../middleware/auth.ts';
import { aiLimiter } from '../config/cors.ts';
import { calculateCost } from '../config/pricing.ts';
import {
  resolveImageUrls,
  trackProjectCost,
  uploadInlineData,
  getWorkingBucket,
  isAdminInitialized,
} from '../services/firebase.ts';
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
} from '../services/vertex.ts';

// Always use Vertex AI for all AI calls
const USE_VERTEX_AI = true;

const router = express.Router();

router.post('/', requireAuth, aiLimiter, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!USE_VERTEX_AI && !apiKey) return res.status(500).json({ error: 'API key not configured' });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 58000);

  try {
    const { method } = req.body;
    let params = req.body.params;

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
          return res.json({ success: true, data: { operation: op.name, isLro: true } });
        } else {
          response = await vertexPredict(sdkParams);
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

      if (imageCount > 0 && projectId && isAdminInitialized()) {
        const cost = calculateCost(sdkParams.model, {
          promptTokenCount: usageMetadata?.promptTokenCount,
          candidatesTokenCount: usageMetadata?.candidatesTokenCount,
        });
        if (cost > 0) {
          await trackProjectCost(projectId, cost, {
            type: 'image',
            imageCount,
            tokenCount: usageMetadata?.totalTokenCount || 0,
          });
        }
      }

      if (usageMetadata && !imageCount && projectId && isAdminInitialized()) {
        const cost = calculateCost(sdkParams.model, {
          promptTokenCount: usageMetadata.promptTokenCount,
          candidatesTokenCount: usageMetadata.candidatesTokenCount,
        }, {});
        if (cost > 0) {
          await trackProjectCost(projectId, cost, {
            type: 'text',
            tokenCount: usageMetadata.totalTokenCount || 0,
          });
        }
      }

      if (projectId && isAdminInitialized()) {
        for (const c of candidates) {
          if (c?.content?.parts) c.content.parts = await uploadInlineData(c.content.parts, projectId);
        }
      }

      const text = candidates
        .flatMap((c: any) => (c?.content?.parts ?? []).filter((p: any) => p.text).map((p: any) => p.text))
        .join('');
      const promptBlock = (response as any).promptFeedback?.blockReason;
      const hasImage = candidates.some((c: any) => c?.content?.parts?.some((p: any) => p.inlineData));
      if (promptBlock && !hasImage) return res.status(422).json({ success: false, error: `Prompt blocked: ${promptBlock}` });
      return res.json({ success: true, data: { candidates, text, promptFeedback: (response as any).promptFeedback || {} } });
    }

    if (method === 'generateImages') {
      const { projectId, ...sdkParams } = params;
      console.log('[generateImages] projectId:', projectId, 'model:', sdkParams.model);
      const genData = await ai(sdkParams.model).models.generateImages(sdkParams);
      const imageCount = genData.generatedImages?.length || 1;

      const cost = calculateCost(sdkParams.model, {}, { numberOfImages: imageCount, sampleCount: sdkParams.config?.numberOfImages || 1 });
      if (cost > 0 && projectId && isAdminInitialized()) {
        await trackProjectCost(projectId, cost, { type: 'image', imageCount });
      }

      if (projectId && isAdminInitialized()) {
        for (const img of (genData.generatedImages ?? [])) {
          if (img.image?.imageBytes) {
            try {
              const bucket = await getWorkingBucket();
              const buf = Buffer.from(img.image.imageBytes, 'base64');
              const dest = `projects/${projectId}/assets/${Date.now()}-generated.png`;
              await bucket.file(dest).save(buf, { metadata: { contentType: 'image/png' }, public: true });
              (img.image as any).storageUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
              console.log(`[Upload] Imagen ${Math.round(buf.byteLength / 1024)}KB → ${(img.image as any).storageUrl}`);
              delete img.image.imageBytes;
            } catch (e) {
              console.error('Storage upload failed:', e);
            }
          }
        }
      }
      return res.json({ success: true, data: genData });
    }

    // Video: @google/genai SDK hardcodes v1beta — use v1 REST directly via vertexGenerateVideos
    if (method === 'generateVideos') {
      if (USE_VERTEX_AI) return res.json({ success: true, data: await vertexGenerateVideos(params) });
      return res.json({ success: true, data: await devAi!.models.generateVideos(params) });
    }

    if (method === 'getOperation') {
      if (USE_VERTEX_AI) return res.json({ success: true, data: await vertexGetOperation(params.operation ?? params) });
      return res.json({ success: true, data: await devAi!.operations.getVideosOperation(params) });
    }

    if (method === 'fetchVideoFile') {
      const { url, projectId } = params;

      // Stream directly to Firebase Storage when projectId is available
      if (projectId && isAdminInitialized()) {
        try {
          const bucket = await getWorkingBucket();
          const dest = `projects/${projectId}/assets/${Date.now()}-generated-video.mp4`;
          const file = bucket.file(dest);
          let contentType: string;
          let resStream: any;

          if (url?.startsWith('data:')) {
            const [header, b64] = url.split(',');
            contentType = header.split(':')[1]?.split(';')[0] || 'video/mp4';
            const buf = Buffer.from(b64, 'base64');
            await file.save(buf, { metadata: { contentType }, public: true });
            return res.json({ success: true, data: { storageUrl: `https://storage.googleapis.com/${bucket.name}/${dest}` } });
          }

          if (USE_VERTEX_AI && url?.startsWith('gs://')) {
            const withoutScheme = url.replace('gs://', '');
            const slashIdx = withoutScheme.indexOf('/');
            const b = withoutScheme.slice(0, slashIdx);
            const o = encodeURIComponent(withoutScheme.slice(slashIdx + 1));
            const token = await vertexAuth.getAccessToken();
            const fetchUrl = `https://storage.googleapis.com/download/storage/v1/b/${b}/o/${o}?alt=media`;
            console.log(`[Veo] Streaming from GCS: ${url}`);
            const r = await fetch(fetchUrl, { headers: { 'Authorization': `Bearer ${token}` }, signal: controller.signal });
            if (!r.ok) throw new Error(`GCS fetch failed: ${r.status}`);
            contentType = r.headers.get('content-type') || 'video/mp4';
            resStream = r.body;
          } else {
            const headers: Record<string, string> = {};
            if (apiKey) headers['x-goog-api-key'] = apiKey;
            console.log(`[Veo] Streaming from HTTP: ${url}`);
            const r = await fetch(url, { headers, signal: controller.signal });
            if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
            contentType = r.headers.get('content-type') || 'video/mp4';
            resStream = r.body;
          }

          if (resStream) {
            const writeStream = file.createWriteStream({ metadata: { contentType }, public: true });
            await pipeline(Readable.fromWeb(resStream), writeStream);
            const storageUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
            console.log(`[Veo] Streamed to Storage: ${storageUrl}`);
            return res.json({ success: true, data: { storageUrl } });
          }
        } catch (uploadErr: any) {
          console.error('[Veo] Streaming upload failed:', uploadErr.message);
          if (uploadErr.name === 'AbortError') return res.status(504).json({ success: false, error: 'Request timed out during video transfer.' });
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
        const r = await fetch(url, { headers, signal: controller.signal });
        base64 = Buffer.from(await r.arrayBuffer()).toString('base64');
        contentType = r.headers.get('content-type') || 'video/mp4';
      }
      return res.json({ success: true, data: { base64, contentType } });
    }

    return res.status(400).json({ error: `Unknown method: ${method}` });
  } catch (err: any) {
    console.error('Gemini proxy error:', err);
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Upstream request timed out (504).' });
    return res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    clearTimeout(timeoutId);
  }
});

export default router;
