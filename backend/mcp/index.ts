/**
 * MCP connector mount point — the only thing server.ts needs to know about.
 *
 * Mounts, in order:
 *  1. The SDK's OAuth authorization-server router at the app root
 *     (/.well-known/*, /authorize, /token, /register, /revoke — with PKCE
 *     verification and per-endpoint rate limiting built in).
 *  2. Our login-form POST target at /mcp/auth/login.
 *  3. The /mcp Streamable HTTP endpoint behind bearer-token auth (Phase A.4).
 *
 * Must be called AFTER the global body parsers and BEFORE the SPA catch-all,
 * otherwise the prod `app.get('*')` swallows every OAuth route.
 */

import type express from 'express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getPublicBaseUrl } from './config.ts';
import { MinnOAuthProvider } from './auth/provider.ts';
import authRoutes from './auth/routes.ts';
import { handleMcpPost, handleMcpGet, handleMcpDelete } from './transport.ts';
import { jobStore } from './jobs.ts';

export function mountMcp(app: express.Express): void {
  const baseUrl = getPublicBaseUrl();
  const provider = new MinnOAuthProvider();

  // Workflow runs are driven in-process — any left 'running' by a restart are lost.
  jobStore.failInterruptedRuns();

  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl: new URL(baseUrl),
      resourceServerUrl: new URL(`${baseUrl}/mcp`),
      resourceName: 'Minn Creative Studio',
      scopesSupported: ['read'],
    })
  );
  app.use('/mcp/auth', authRoutes);

  const bearer = requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
  });
  app.post('/mcp', bearer, handleMcpPost);
  app.get('/mcp', bearer, handleMcpGet);
  app.delete('/mcp', bearer, handleMcpDelete);

  console.log(`[MCP] Connector mounted at /mcp — issuer ${baseUrl}`);
}
