/**
 * Read-only Library tool: search_library — the global asset gallery across
 * every project (playground included), same query the Library UI uses.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { assets } from '../../services/database.ts';
import { getPublicBaseUrl } from '../config.ts';
import { guard } from '../guard.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult } from './util.ts';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function toAbsoluteUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${getPublicBaseUrl()}${url}`;
}

export function registerLibraryTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'search_library',
    {
      title: 'Search the asset library',
      description:
        'Find existing images/videos/audio across all projects (uploads and generations). Search matches ' +
        'filenames and generation prompts. Use the returned url to reference an asset (e.g. as a future ' +
        'generation reference image).',
      inputSchema: {
        search: z.string().optional().describe('Matches filename and the prompt that generated the asset'),
        type: z.enum(['image', 'video', 'audio', 'file']).optional(),
        projectId: z.string().min(1).optional().describe("Scope to one project (or 'playground')"),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'search_library', args, async () => {
        const rows = assets.findAllWithProject({
          type: args.type,
          projectId: args.projectId,
          search: args.search,
          limit: args.limit ?? DEFAULT_LIMIT,
          offset: args.offset,
        });
        return jsonResult(
          {
            assets: rows.map((row: any) => ({
              id: row.id,
              type: row.type,
              filename: row.filename,
              projectId: row.project_id,
              projectName: row.project_name ?? null,
              url: toAbsoluteUrl(row.url),
              mimeType: row.mime_type,
              sizeBytes: row.size_bytes,
              prompt: row.metadata?.prompt ?? null,
              via: row.metadata?.via ?? null,
              createdAt: row.created_at,
            })),
            page: { limit: args.limit ?? DEFAULT_LIMIT, offset: args.offset ?? 0, returned: rows.length },
          },
          `${rows.length} asset(s)`
        );
      })
  );
}
