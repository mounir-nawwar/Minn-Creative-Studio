/**
 * Asset write tools: upload_asset_from_url, move_asset.
 * Reuses the storage service (SSRF-guarded fetch, safe project paths, move
 * with URL rewrite) — the same code paths the Library UI uses.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { uploadFromUrl, moveAssetToProject } from '../../services/storage.ts';
import { projects } from '../../services/database.ts';
import { getPublicBaseUrl } from '../config.ts';
import { guard } from '../guard.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult, errorResult } from './util.ts';

export function registerAssetTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'upload_asset_from_url',
    {
      title: 'Upload an asset from a URL',
      description:
        'Download an external image/video/audio file into a project so it can be used as a generation reference. ' +
        "Use 'playground' for scratch. The URL must be publicly reachable http(s).",
      inputSchema: {
        projectId: z.string().min(1),
        url: z.string().url(),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'upload_asset_from_url', args, async () => {
        if (!projects.findById(args.projectId)) {
          return errorResult(`Project not found: ${args.projectId}`);
        }
        const result = await uploadFromUrl(args.projectId, ctx.user.id, args.url, {
          metadata: { via: 'mcp', sourceUrl: args.url },
        });
        return jsonResult(
          { assetId: result.id, url: `${getPublicBaseUrl()}${result.url}` },
          'Asset uploaded'
        );
      })
  );

  server.registerTool(
    'move_asset',
    {
      title: 'Move an asset to another project',
      description:
        'Relocate an asset (file + record) into a different project — e.g. promote a playground result into a ' +
        'client project. Get asset ids from search_library.',
      inputSchema: {
        assetId: z.string().min(1),
        targetProjectId: z.string().min(1),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'move_asset', args, async () => {
        try {
          const moved = await moveAssetToProject(args.assetId, args.targetProjectId);
          return jsonResult(
            { assetId: args.assetId, projectId: args.targetProjectId, url: `${getPublicBaseUrl()}${moved.url}` },
            'Asset moved'
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('not found')) return errorResult(message);
          throw err;
        }
      })
  );
}
