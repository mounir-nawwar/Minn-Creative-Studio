/**
 * Inline creation tools: generate_text, generate_image, generate_speech,
 * generate_music_clip. Each completes within one request (Cloudflare-safe);
 * video and long-form music live in tools/jobs.ts as start/check job pairs.
 *
 * All calls flow through runGeneration (the same path as the app), so cost
 * tracking, storage upload, and asset rows happen automatically — tagged
 * via:'mcp'. Param shapes mirror src/services/gemini/* exactly.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runGeneration } from '../../services/generation.ts';
import { projects, assets } from '../../services/database.ts';
import { AUDIO_MODELS, TTS_VOICES, findModel } from '../../../src/lib/models.ts';
import { guard } from '../guard.ts';
import type { ToolContext } from '../server.ts';
import { imagePartFromUrl } from '../media.ts';
import { projectContextFor } from '../projectContext.ts';
import { jsonResult, errorResult } from './util.ts';

const BLOCK_NONE_SAFETY = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

const MAX_REFERENCE_IMAGES = 6;
/** Gemini image models generate one image per call — cap sequential calls to stay well under Cloudflare's window */
const MAX_GEMINI_IMAGE_SAMPLES = 2;
const MAX_IMAGEN_SAMPLES = 4;

const projectIdSchema = z.string().min(1).describe("Target project id, or 'playground' for scratch work");

function requireProject(projectId: string) {
  const project = projects.findById(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}. Use list_projects, or 'playground'.`);
  return project;
}

function requireModelOfMode(modelId: string, mode: 'text' | 'image' | 'video' | 'audio') {
  const model = findModel(modelId);
  if (!model || model.mode !== mode) {
    throw new Error(`Unknown ${mode} model: ${modelId}. Call list_models with mode='${mode}' for valid ids.`);
  }
  return model;
}

/** The proxy leaves storageUrl on uploaded parts; resolve the asset row for ids. */
function assetIdForUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return assets.findByUrl(url)?.id;
}

export function registerGenerationTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'generate_text',
    {
      title: 'Generate text',
      description:
        'Run a text/vision prompt through a Gemini model. Optionally attach images by url (Library /storage urls ' +
        'or external http urls) and a system instruction. The project\'s brand context (colors, style keywords, ' +
        'AI instructions) is injected automatically, exactly like in-app generations — pass ' +
        'includeProjectContext:false to opt out. Cost is tracked to the project.',
      inputSchema: {
        projectId: projectIdSchema,
        prompt: z.string().min(1),
        model: z.string().optional().describe("Text model id (default 'gemini-3-flash-preview')"),
        systemInstruction: z.string().optional(),
        imageUrls: z.array(z.string()).max(8).optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxOutputTokens: z.number().int().min(1).max(65536).optional(),
        grounding: z.boolean().optional().describe('Enable Google Search + URL reading tools'),
        includeProjectContext: z.boolean().optional().describe('Default true (no-op for playground)'),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'generate_text', args, async () => {
        requireProject(args.projectId);
        const modelId = args.model ?? 'gemini-3-flash-preview';
        requireModelOfMode(modelId, 'text');

        const parts: any[] = [{ text: args.prompt }];
        for (const url of args.imageUrls ?? []) parts.push(imagePartFromUrl(url));

        // Same placement as the app (textService): stable context goes in the
        // system instruction so Gemini's prefix caching applies.
        const context = args.includeProjectContext !== false ? projectContextFor(args.projectId) : '';
        const systemInstruction = context
          ? `${args.systemInstruction ? `${args.systemInstruction}\n\n` : ''}Project Context:\n${context}`
          : args.systemInstruction;

        const data = await runGeneration({
          method: 'generateContent',
          params: {
            model: modelId,
            contents: [{ role: 'user', parts }],
            config: {
              ...(systemInstruction && { systemInstruction }),
              ...(args.maxOutputTokens && { maxOutputTokens: args.maxOutputTokens }),
              ...(args.temperature !== undefined && { temperature: args.temperature }),
              ...(args.grounding && { tools: [{ googleSearch: {} }, { urlContext: {} }] }),
            },
            projectId: args.projectId,
          },
          userId: ctx.user.id,
          via: 'mcp',
        });

        return { content: [{ type: 'text' as const, text: data.text || '(empty response)' }] };
      })
  );

  server.registerTool(
    'generate_image',
    {
      title: 'Generate image(s)',
      description:
        'Generate images with Imagen 4 or a Gemini image model (nano-banana family). Supports aspect ratio, seed, ' +
        'sample count, and reference images (Library /storage urls or external urls) for the Gemini models — use ' +
        'references for try-ons, product placement, and style matching. Images are saved to the project ' +
        'automatically and appear in the Library. The project\'s brand context is injected into the prompt ' +
        'automatically (like in-app generations) — pass includeProjectContext:false to opt out. Bake exclusions ' +
        'into the prompt (no negativePrompt on image models). Check list_models(mode=\'image\') for capabilities.',
      inputSchema: {
        projectId: projectIdSchema,
        prompt: z.string().min(1),
        model: z.string().optional().describe("Image model id (default 'gemini-3.1-flash-image')"),
        aspectRatio: z.string().optional().describe("e.g. '1:1', '3:4', '16:9' (default '1:1')"),
        resolution: z.string().optional().describe("Gemini image models only: '1K', '2K', '4K'"),
        sampleCount: z.number().int().min(1).max(MAX_IMAGEN_SAMPLES).optional(),
        seed: z.number().int().optional(),
        referenceImages: z
          .array(z.object({ url: z.string() }))
          .max(MAX_REFERENCE_IMAGES)
          .optional(),
        temperature: z.number().min(0).max(2).optional(),
        includeProjectContext: z.boolean().optional().describe('Default true (no-op for playground)'),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'generate_image', args, async () => {
        requireProject(args.projectId);
        // Imagen is unavailable on this Vertex project (every imagen-* id 404s),
        // so all image generation goes through the Gemini image models.
        const modelId = args.model ?? 'gemini-3.1-flash-image';
        requireModelOfMode(modelId, 'image');
        const aspectRatio = args.aspectRatio ?? '1:1';

        // Same prompt framing as the app (imageService)
        const context = args.includeProjectContext !== false ? projectContextFor(args.projectId) : '';
        const fullPrompt = context
          ? `Project Context: ${context}\n\nTask: Generate an image based on this prompt: ${args.prompt}`
          : args.prompt;

        // Gemini image models: one image per call, sequential (mirrors the app)
        const sampleCount = Math.min(args.sampleCount ?? 1, MAX_GEMINI_IMAGE_SAMPLES);
        const parts: any[] = [];
        for (const ref of args.referenceImages ?? []) parts.push(imagePartFromUrl(ref.url));
        parts.push({ text: fullPrompt });

        const baseConfig: any = {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio, ...(args.resolution && { imageSize: args.resolution }) },
          ...(args.temperature !== undefined && { temperature: args.temperature }),
          safetySettings: BLOCK_NONE_SAFETY,
        };

        const images: { url: string; assetId?: string }[] = [];
        for (let i = 0; i < sampleCount; i++) {
          const data = await runGeneration({
            method: 'generateContent',
            params: {
              model: modelId,
              contents: [{ role: 'user', parts }],
              config: {
                ...baseConfig,
                ...(args.seed !== undefined && { seed: sampleCount > 1 ? args.seed + i : args.seed }),
              },
              projectId: args.projectId,
            },
            userId: ctx.user.id,
            via: 'mcp',
          });
          const inline = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
          if (inline?.storageUrl) images.push({ url: inline.storageUrl, assetId: assetIdForUrl(inline.storageUrl) });
        }
        if (!images.length) return errorResult('No images generated (the prompt may have been filtered).');
        return jsonResult({ model: modelId, aspectRatio, seed: args.seed, images }, `Generated ${images.length} image(s)`);
      })
  );

  server.registerTool(
    'generate_speech',
    {
      title: 'Generate speech (TTS)',
      description:
        `Text-to-speech with Gemini TTS. Voices: ${TTS_VOICES.join(', ')}. The audio file is saved to the project.`,
      inputSchema: {
        projectId: projectIdSchema,
        text: z.string().min(1).max(5000),
        voice: z.string().optional().describe("Voice name (default 'Kore')"),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'generate_speech', args, async () => {
        requireProject(args.projectId);
        const model = AUDIO_MODELS.find((m) => m.id.includes('tts'))?.id ?? 'gemini-2.5-flash-preview-tts';
        const data = await runGeneration({
          method: 'generateContent',
          params: {
            model,
            contents: [{ parts: [{ text: args.text }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: args.voice ?? 'Kore' } } },
              safetySettings: BLOCK_NONE_SAFETY,
            },
            projectId: args.projectId,
          },
          userId: ctx.user.id,
          via: 'mcp',
        });
        const inline = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
        if (!inline?.storageUrl) return errorResult('No audio generated.');
        return jsonResult({ model, voice: args.voice ?? 'Kore', url: inline.storageUrl, assetId: assetIdForUrl(inline.storageUrl) }, 'Speech generated');
      })
  );

  server.registerTool(
    'generate_music_clip',
    {
      title: 'Generate a short music clip',
      description:
        'Short instrumental clip via Lyria (~30s, synchronous). For longer tracks use start_music_job. ' +
        'Optional musical controls: bpm, density, brightness, musicScale, negativePrompt, seed.',
      inputSchema: {
        projectId: projectIdSchema,
        prompt: z.string().min(1),
        negativePrompt: z.string().optional(),
        seed: z.number().int().optional(),
        bpm: z.number().int().min(40).max(220).optional(),
        density: z.number().min(0).max(1).optional(),
        brightness: z.number().min(0).max(1).optional(),
        musicScale: z.string().optional(),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'generate_music_clip', args, async () => {
        requireProject(args.projectId);
        const model = AUDIO_MODELS.find((m) => m.id.includes('clip'))?.id ?? 'lyria-3-clip-preview';
        const data = await runGeneration({
          method: 'generateContent',
          params: {
            model,
            contents: [{ parts: [{ text: args.prompt }] }],
            config: {
              responseModalities: ['AUDIO'],
              ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
              ...(args.seed !== undefined && { seed: args.seed }),
              ...(args.bpm !== undefined && { bpm: args.bpm }),
              ...(args.density !== undefined && { density: args.density }),
              ...(args.brightness !== undefined && { brightness: args.brightness }),
              ...(args.musicScale && { scale: args.musicScale }),
              safetySettings: BLOCK_NONE_SAFETY,
            },
            projectId: args.projectId,
          },
          userId: ctx.user.id,
          via: 'mcp',
        });
        const inline = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
        if (!inline?.storageUrl) return errorResult('No audio generated.');
        return jsonResult({ model, url: inline.storageUrl, assetId: assetIdForUrl(inline.storageUrl) }, 'Music clip generated');
      })
  );
}
