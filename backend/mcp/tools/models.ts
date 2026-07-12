/**
 * Read-only model registry tool: list_models.
 *
 * Imports the frontend studio registry (src/lib/models.ts) directly — it is
 * pure data with no browser imports (guarded by modelsNodeImport.test.ts) —
 * and joins each model with its backend pricing entry.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TEXT_MODELS, CHAT_IMAGE_MODELS, VIDEO_MODELS, AUDIO_MODELS, type StudioModel } from '../../../src/lib/models.ts';
import { MODEL_PRICING } from '../../config/pricing.ts';
import { auditLog } from '../audit.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult } from './util.ts';

const ALL_MODELS: StudioModel[] = [...TEXT_MODELS, ...CHAT_IMAGE_MODELS, ...VIDEO_MODELS, ...AUDIO_MODELS];

export function registerModelTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_models',
    {
      title: 'List generation models',
      description:
        'The studio model registry: every available text/image/video/audio model with its supported ' +
        'parameters (aspect ratios, resolutions, seed, negative prompt, reference images, durations, voices), ' +
        'defaults, and pricing. Check this before generating so parameters match what the model supports.',
      inputSchema: { mode: z.enum(['text', 'image', 'video', 'audio']).optional() },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'list_models', args, async () => {
        const models = (args.mode ? ALL_MODELS.filter((m) => m.mode === args.mode) : ALL_MODELS).map((model) => ({
          id: model.id,
          label: model.label,
          mode: model.mode,
          description: model.description ?? null,
          priceHint: model.priceHint ?? null,
          pricing: MODEL_PRICING[model.id] ?? null,
          supports: model.supports,
          defaults: model.defaults,
        }));
        return jsonResult({ models }, `${models.length} model(s)`);
      })
  );
}
