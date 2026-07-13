// @vitest-environment node
/**
 * End-to-end harness: boots the REAL Express app on an ephemeral port and
 * drives it with the REAL MCP SDK client over Streamable HTTP.
 *
 * This is the gate for upgrading @modelcontextprotocol/sdk (pinned 1.29.0):
 * if the protocol handshake, auth middleware, tool schemas, or session
 * handling shift under us, this fails instead of production.
 *
 * Read-only tools only — nothing here spends money.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../../../server.ts';
import { db } from '../../services/database.ts';
import { oauthStore } from '../auth/store.ts';

const CLIENT_ID = 'e2e-test-client';

let server: Server;
let baseUrl: string;
let accessToken: string;
let userId: string;

async function connectClient(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: 'e2e', version: '0.0.1' });
  await client.connect(transport);
  return client;
}

/** Tool results are text-first; strip the human summary line to get the JSON. */
function payload(result: any) {
  const text = result.content[0].text as string;
  return JSON.parse(text.replace(/^[^\n{[]*\n\n/, ''));
}

beforeAll(async () => {
  const { app } = await createApp({ serveFrontend: false });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${address.port}`;

  const user = db.prepare("SELECT id FROM users WHERE username = 'mounir.nawwar'").get() as { id: string };
  userId = user.id;
  oauthStore.createClient({
    client_id: CLIENT_ID,
    client_name: 'E2E test',
    redirect_uris: ['http://localhost/callback'],
    token_endpoint_auth_method: 'none',
  } as any);
  accessToken = oauthStore.issueTokenPair({
    clientId: CLIENT_ID,
    userId,
    scope: 'read write generate',
  }).accessToken;
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('MCP connector end-to-end', () => {
  test('OAuth metadata is discoverable', async () => {
    const as = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`).then((r) => r.json());
    expect(as.issuer).toBeTruthy();
    expect(as.code_challenge_methods_supported).toContain('S256');
    expect(as.registration_endpoint).toContain('/register');
    expect(as.scopes_supported).toEqual(['read', 'write', 'generate']);

    const prm = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`).then((r) => r.json());
    expect(prm.resource).toContain('/mcp');
  });

  test('an unauthenticated call is refused and points at the metadata', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata');
  });

  test('a garbage token is refused', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mcp_at_not_a_real_token' },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  test('a real client can handshake and list the full tool set', async () => {
    const client = await connectClient(accessToken);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);

      // one representative per capability area
      for (const expected of [
        'list_projects', 'search_library', 'list_models',
        'generate_image', 'start_video_job', 'check_job',
        'describe_node_types', 'set_workflow', 'run_workflow',
        'get_audit_log', 'get_connector_status',
      ]) {
        expect(names, expected).toContain(expected);
      }
      // every tool must expose an input schema the client can render
      for (const tool of tools) expect(tool.inputSchema, tool.name).toBeTruthy();
    } finally {
      await client.close();
    }
  }, 20_000);

  test('read-only tools return real data and are audited', async () => {
    const client = await connectClient(accessToken);
    try {
      const before = (db.prepare('SELECT COUNT(*) AS n FROM mcp_audit_log').get() as { n: number }).n;

      const projects = payload(await client.callTool({ name: 'list_projects', arguments: {} }));
      expect(Array.isArray(projects.projects)).toBe(true);

      const models = payload(await client.callTool({ name: 'list_models', arguments: { mode: 'image' } }));
      expect(models.models.length).toBeGreaterThan(0);
      expect(models.models[0]).toHaveProperty('supports');

      const nodeInfo = payload(await client.callTool({ name: 'describe_node_types', arguments: { nodeType: 'imagen' } }));
      expect(nodeInfo.inputs.map((i: any) => i.id)).toContain('prompt');

      const status = payload(await client.callTool({ name: 'get_connector_status', arguments: {} }));
      expect(status.spendToday).toHaveProperty('dailyLimitUsd');

      const after = (db.prepare('SELECT COUNT(*) AS n FROM mcp_audit_log').get() as { n: number }).n;
      expect(after).toBe(before + 4);

      const last = db
        .prepare('SELECT tool, user_id, status FROM mcp_audit_log ORDER BY id DESC LIMIT 1')
        .get() as { tool: string; user_id: string; status: string };
      expect(last.user_id).toBe(userId);
      expect(last.status).toBe('ok');
    } finally {
      await client.close();
    }
  }, 20_000);

  test('a missing resource comes back as a tool error, not a protocol failure', async () => {
    const client = await connectClient(accessToken);
    try {
      const result: any = await client.callTool({ name: 'get_project', arguments: { projectId: 'does-not-exist' } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    } finally {
      await client.close();
    }
  }, 20_000);

  test('scopes are enforced on a live connection', async () => {
    const readOnly = oauthStore.issueTokenPair({ clientId: CLIENT_ID, userId, scope: 'read write' }).accessToken;
    const client = await connectClient(readOnly);
    try {
      const denied: any = await client.callTool({
        name: 'generate_image',
        arguments: { projectId: 'playground', prompt: 'should never run' },
      });
      expect(denied.isError).toBe(true);
      expect(denied.content[0].text).toContain("does not have 'generate' permission");
    } finally {
      await client.close();
    }
  }, 20_000);
});
