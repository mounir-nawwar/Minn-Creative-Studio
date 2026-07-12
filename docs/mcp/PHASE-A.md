# Phase A — Server skeleton, OAuth 2.1, audit log, read-only tools

> Execution doc. A fresh session should be able to implement Phase A from this file +
> [00-OVERVIEW.md](./00-OVERVIEW.md) alone. All file/line references verified 2026-07-11 —
> re-verify with grep before relying on them.

## Objective

After Phase A, a Claude client can:
1. Discover the connector at `https://studio.minnagency.com/mcp` (or `http://localhost:3000/mcp` in dev).
2. Complete the full OAuth 2.1 flow (DCR → dark login page → PKCE code exchange) as mounir or rana.
3. Call 7 **read-only** tools: `list_projects`, `get_project`, `list_workflows`, `get_workflow`,
   `search_library`, `list_models`, `get_usage_summary`.
4. Every call lands in `mcp_audit_log` attributed to the right user.

No writes to app data in this phase (only the new OAuth/audit tables).

## Prerequisites / assumptions to re-verify

| Assumption | Where | How to check |
|---|---|---|
| `@modelcontextprotocol/sdk@1.29.0` declares `zod: "^3.25 \|\| ^4.0"` | npm | `npm view @modelcontextprotocol/sdk@1.29.0 peerDependencies` |
| Global `express.json({limit:'50mb'})` runs before route handlers | `server.ts:51-59` | read file |
| API router mounted at `server.ts:99`; prod SPA catch-all `app.get('*')` at `server.ts:~112` | `server.ts` | read file — **MCP/OAuth mounts must land between these** |
| `login({username,password})` timing-safe, returns `{accessToken,refreshToken,user}` or null | `backend/services/auth.ts:145-198` | read file |
| `loginLimiter` (15 min / 5 attempts) exists and is unmounted | `backend/config/cors.ts:21` | grep `loginLimiter` |
| `db` exported | `backend/services/database.ts:830` | grep `export.*db` |
| `assets.findAllWithProject(filters)` exists (built for the Library) | `backend/services/database.ts:~589` | grep |
| `usageLogs.getByProjectId(projectId, start?, end?)` exists | `backend/services/database.ts:~666` | grep |
| `src/lib/models.ts` has no browser-only imports (only `src/nodes/imagenModels.ts`, pure data) | both files | check import lines |
| `trust proxy = 1` set in prod | `server.ts:46-48` | read file |

## Files to create (all under `backend/mcp/`)

### `backend/mcp/config.ts`
Constants + env access. No logic.
```ts
export function getPublicBaseUrl(): string   // process.env.PUBLIC_BASE_URL || 'http://localhost:3000' (warn in prod if unset)
export const ALLOWED_MCP_HOSTS: string[]     // ['studio.minnagency.com', 'localhost:3000', '127.0.0.1:3000']
export const ACCESS_TOKEN_TTL_MS  = 60 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const AUTH_CODE_TTL_MS     = 10 * 60 * 1000
export const SESSION_IDLE_MS      = 30 * 60 * 1000
export const MAX_AUDIT_PARAM_BYTES = 4096
```

### `backend/mcp/auth/store.ts`
Owns the three OAuth tables. Executes DDL at import via `db.exec(...)` (same pattern as
`initializeSchema`). Pure synchronous functions over better-sqlite3 — fully unit-testable.

```sql
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT,                -- NULL for public clients (claude.ai uses PKCE, no secret)
  client_name TEXT,
  redirect_uris TEXT NOT NULL,            -- JSON array
  metadata TEXT NOT NULL DEFAULT '{}',    -- full OAuthClientInformationFull JSON (round-trips DCR)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code_hash TEXT PRIMARY KEY,             -- sha256(code); raw code never stored
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,           -- S256 only
  scope TEXT,
  resource TEXT,                          -- RFC 8707 resource indicator
  expires_at DATETIME NOT NULL,           -- now + 10 min
  used_at DATETIME,                       -- single-use guard
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,                    -- generateId()
  token_hash TEXT UNIQUE NOT NULL,        -- sha256(opaque token)
  token_type TEXT NOT NULL CHECK(token_type IN ('access','refresh')),
  pair_id TEXT NOT NULL,                  -- links access+refresh; revoke/rotate as a pair
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT,
  resource TEXT,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_hash ON oauth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_pair ON oauth_tokens(pair_id);
```

Exports:
```ts
sha256(value: string): string                       // hex digest
generateOpaqueToken(prefix: 'mcp_at_'|'mcp_rt_'|'mcp_code_'): string  // prefix + base64url(randomBytes(32))
createClient(info: OAuthClientInformationFull): void
getClient(clientId: string): OAuthClientInformationFull | undefined   // parse metadata column
createAuthorizationCode(args: { code, clientId, userId, redirectUri, codeChallenge, scope?, resource? }): void
consumeAuthorizationCode(code: string): CodeRow | undefined
  // single-use: UPDATE ... SET used_at = CURRENT_TIMESTAMP WHERE code_hash=? AND used_at IS NULL
  //             AND expires_at > CURRENT_TIMESTAMP  → then SELECT; undefined if no row updated
issueTokenPair(args: { clientId, userId, scope?, resource? }):
  { accessToken, refreshToken, expiresInSeconds }   // inserts 2 rows sharing pair_id
findAccessToken(rawToken: string): TokenRow | undefined   // hash → lookup, checks type/expiry/revoked
rotateRefreshToken(rawToken: string): { accessToken, refreshToken, expiresInSeconds } | undefined
  // validates old refresh row, revokes the whole old pair, issues a new pair (same user/client/scope)
revokeTokenPair(rawToken: string): void             // by either token of the pair
```

**Datetime gotcha:** existing tables store SQLite `CURRENT_TIMESTAMP` (UTC, `YYYY-MM-DD HH:MM:SS`).
Store `expires_at` in the same format (e.g. `new Date(Date.now()+ttl).toISOString().replace('T',' ').slice(0,19)`)
so SQL comparisons against `CURRENT_TIMESTAMP` work.

### `backend/mcp/auth/provider.ts`
`class MinnOAuthProvider implements OAuthServerProvider` (from
`@modelcontextprotocol/sdk/server/auth/provider.js`). Method contracts:

| Method | Behavior |
|---|---|
| `clientsStore` getter | `{ getClient, registerClient }` → store.ts. Presence of `registerClient` enables DCR `/register` |
| `authorize(client, params, res)` | Render `loginPage` HTML (200, `Cache-Control: no-store`) embedding hidden fields: `client_id, redirect_uri, code_challenge, state, scope, resource`. Does NOT issue anything yet |
| `challengeForAuthorizationCode(client, code)` | Look up the (unused, unexpired) code row → return stored `code_challenge`. SDK does the S256 verification against the client's `code_verifier` |
| `exchangeAuthorizationCode(client, code, …)` | `consumeAuthorizationCode` (single-use), verify `client_id` matches the row, `issueTokenPair` → return `{ access_token, token_type:'bearer', expires_in, refresh_token, scope }` |
| `exchangeRefreshToken(client, refreshToken, scopes?)` | `rotateRefreshToken` → same return shape; throw invalid_grant if unknown/revoked |
| `verifyAccessToken(token)` | `findAccessToken` → `AuthInfo { token, clientId, scopes: scope?.split(' ') ?? [], expiresAt: epochSeconds, extra: { userId, username } }`; throw/reject if unknown/expired/revoked. Fetch username via `users.findById` |
| `revokeToken(client, { token })` | `revokeTokenPair(token)`; idempotent |

### `backend/mcp/auth/loginPage.ts`
`renderLoginPage(opts: { clientName, scopes, oauthParams: Record<string,string>, error?: string }): string`
— one template-literal HTML document, no framework, no external assets:
- bg `#0a0a0a`, centered card (`#141414`, 1px `rgba(255,255,255,.08)` ring, 16px radius),
  heading "Connect Claude to Minn Creative Studio", client name + scope list (consent),
  username + password inputs (dark, focus ring teal), submit button `#0097A7` (hover `#00a9bb`),
  inline error paragraph when `error` set.
- Form `method="POST" action="/mcp/auth/login"` with the OAuth params as `<input type="hidden">`
  (HTML-escape every injected value — client names are attacker-controlled via DCR).

### `backend/mcp/auth/routes.ts`
Express router with one route:
- `POST /login` (mounted at `/mcp/auth`): `loginLimiter` first. Body: `username`, `password` +
  hidden OAuth params. Steps:
  1. `login({username, password})` (existing service, timing-safe). Fail → re-render login page
     with generic error (counts against the limiter).
  2. **Re-validate** `client_id` exists in store and `redirect_uri` is in the client's registered
     `redirect_uris` — never trust hidden fields.
  3. `generateOpaqueToken('mcp_code_')` → `createAuthorizationCode(...)`.
  4. `302` → `redirect_uri?code=...&state=...` (`Cache-Control: no-store`).

### `backend/mcp/audit.ts`
Owns `mcp_audit_log` (DDL at import) + the wrapper every tool registration uses.
```sql
CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_id TEXT,
  tool TEXT NOT NULL,
  params TEXT DEFAULT '{}',               -- JSON, truncated to 4096 bytes
  status TEXT NOT NULL CHECK(status IN ('ok','error')),
  error TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_created ON mcp_audit_log(created_at);
```
```ts
auditToolCall<T>(ctx: { userId: string; sessionId?: string }, tool: string,
                 params: unknown, fn: () => Promise<T>): Promise<T>
// stringify+truncate params → time fn() → insert ok row | insert error row (message) and rethrow
```

### `backend/mcp/server.ts`
```ts
createMcpServer(user: AuthUser, sessionId: string): McpServer
// new McpServer({ name: 'minn-creative-studio', version: <package.json version> })
// ctx = { user, sessionId }
// registerProjectTools(server, ctx); registerWorkflowTools(server, ctx);
// registerLibraryTools(server, ctx); registerModelTools(server, ctx);
```
One `McpServer` per session (cheap; tools close over the user → no per-call user plumbing).

### `backend/mcp/transport.ts`
Session lifecycle around `StreamableHTTPServerTransport`
(`@modelcontextprotocol/sdk/server/streamableHttp.js`):
```ts
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; userId: string; lastSeen: number }>()

handleMcpPost(req, res):
  sid = req.headers['mcp-session-id']
  if sid && sessions.has(sid):
      if (sessions.get(sid).userId !== req.auth.extra.userId) → 403
      touch lastSeen; return session.transport.handleRequest(req, res, req.body)
  if isInitializeRequest(req.body):        // from '@modelcontextprotocol/sdk/types.js'
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
        enableDnsRebindingProtection: true,
        allowedHosts: ALLOWED_MCP_HOSTS,
        onsessioninitialized: (sid) => sessions.set(sid, { transport, userId, lastSeen: Date.now() }),
      })
      transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId) }
      await createMcpServer(user, sid).connect(transport)
      return transport.handleRequest(req, res, req.body)
  → 400 (JSON-RPC error: no session / not initialize)

handleMcpGet(req, res)  → 405 in Phase A (JSON-response mode; no standalone SSE stream)
handleMcpDelete(req,res)→ route to session transport (terminates), else 404
setInterval sweeper (60s): close+delete sessions idle > SESSION_IDLE_MS
```
**Load-bearing:** always pass `req.body` as the third arg to `handleRequest` — the global
`express.json` already consumed the stream.

### `backend/mcp/index.ts`
```ts
export function mountMcp(app: express.Express): void {
  const provider = new MinnOAuthProvider();
  app.use(mcpAuthRouter({ provider, issuerUrl: new URL(getPublicBaseUrl()), scopesSupported: ['read'] }));
  // Verify /.well-known/oauth-protected-resource is served by this SDK version;
  // if not: add mcpAuthMetadataRouter({ oauthMetadata, resourceServerUrl }) as well.
  app.use('/mcp/auth', authRoutes);
  const bearer = requireBearerAuth({ verifier: provider,
    resourceMetadataUrl: `${getPublicBaseUrl()}/.well-known/oauth-protected-resource` });
  app.post('/mcp', bearer, handleMcpPost);
  app.get('/mcp', bearer, handleMcpGet);
  app.delete('/mcp', bearer, handleMcpDelete);
}
```

### Tool files — `backend/mcp/tools/{projects,workflows,library,models}.ts`

Registration pattern (zod v4 raw shapes; every handler body wrapped in `auditToolCall`):
```ts
server.registerTool('list_projects',
  { title: 'List projects', description: '…', inputSchema: {} },
  async (args) => auditToolCall(ctx, 'list_projects', args, async () => ({
    content: [{ type: 'text', text: summary }],
    structuredContent: { projects },
  })));
```

| Tool | Input schema | Backend call | structuredContent |
|---|---|---|---|
| `list_projects` | `{}` | `projects.findAll()` (playground already excluded) | `{ projects: [{ id, name, description, ownerUserId, ownerIsCaller, totalCost, createdAt, updatedAt }] }` |
| `get_project` | `{ projectId: z.string() }` | `projects.findById` + `workflows.findByProjectId(id).length` + asset count | project + counts; MCP error content `isError:true` if not found |
| `list_workflows` | `{ projectId: z.string().optional() }` | `workflows.findByProjectId` else all-projects listing (mirror `GET /api/workflows`) | `{ workflows: [{ id, projectId, name, nodeCount, edgeCount, updatedAt }] }` — counts only |
| `get_workflow` | `{ workflowId: z.string() }` | `workflows.findById` (JSON already parsed) | full `{ id, projectId, name, nodes, edges }` |
| `search_library` | `{ search?: string, type?: z.enum(['image','video','audio','file']), projectId?: string, limit?: number (default 25, max 100), offset?: number }` | `assets.findAllWithProject` | `{ assets: [{ id, type, filename, projectId, projectName, url (absolute: PUBLIC_BASE_URL + url), mimeType, sizeBytes, prompt (from metadata), createdAt }] }` |
| `list_models` | `{ mode: z.enum(['text','image','video','audio']).optional() }` | `src/lib/models.ts` registry + `MODEL_PRICING` from `backend/config/pricing.ts` | `{ models: [{ id, label, mode, description, priceHint, pricing, supports, defaults }] }` |
| `get_usage_summary` | `{ projectId: z.string(), startDate?: string, endDate?: string }` | `usageLogs.getByProjectId` aggregated by type + project `usage` JSON | `{ projectId, totals: { cost, byType }, projectUsage }` |

Descriptions should tell Claude *when* to use each tool (e.g. `search_library`: "find existing
images/videos/audio across all projects to reuse as references").

### Tests — `backend/mcp/__tests__/`
- `authStore.test.ts`: token issue→find round-trip; expiry honored; refresh rotation revokes old
  pair; auth code single-use (second consume returns undefined); revocation.
- `provider.test.ts`: `verifyAccessToken` returns userId in extra; rejects revoked/expired;
  `challengeForAuthorizationCode` returns stored challenge; exchange with wrong client_id fails.
- `audit.test.ts`: ok + error rows written; params truncated at 4096 bytes; errors rethrown.
- One test importing `src/lib/models.ts` under Node (guards the backend-import assumption).
- Use a temp-file or `:memory:` DB if `db` is injectable; otherwise run against the dev DB file
  copy in a temp dir (pattern used before: copy `data/minn-studio.db` to scratch). Prefer
  extracting store functions to accept a `Database` handle for testability.

## Files to modify

| File | Change |
|---|---|
| `server.ts` (root) | 2 lines: `import { mountMcp } from './backend/mcp/index.ts';` + `mountMcp(app);` placed **after** `app.use('/api', apiRouter)` (line 99) and **before** the dev/prod static block (lines 106–113) |
| `.env.example` | `PUBLIC_BASE_URL=https://studio.minnagency.com` with comment (dev fallback localhost:3000) |
| `package.json` | `"@modelcontextprotocol/sdk": "1.29.0"` (exact pin) |

## Express 4 vs SDK Express 5 — the one integration risk

`mcpAuthRouter` constructs its router with the SDK's bundled Express 5. Routers are plain
`(req,res,next)` middleware so mounting inside our Express 4 app is expected to work — but
**smoke-test it immediately after the store/provider exist**, before building the login page:

```
npm run dev
curl -i http://localhost:3000/.well-known/oauth-authorization-server   # expect 200 JSON, issuer = PUBLIC_BASE_URL
curl -i -X POST http://localhost:3000/register -H "Content-Type: application/json" \
     -d '{"redirect_uris":["https://claude.ai/api/mcp/auth_callback"],"client_name":"smoke"}'   # expect 201 JSON
```

**Fallback if it misbehaves** (hangs, path mismatches, `req.query` weirdness): the SDK exports each
handler individually — `authorizationHandler`, `tokenHandler`, `clientRegistrationHandler`,
`revocationHandler`, `metadataHandler` under `@modelcontextprotocol/sdk/server/auth/handlers/*` —
assemble them on our own `express.Router()` (v4) at the same paths, plus hand-written metadata
JSON. Confined to `backend/mcp/index.ts`; nothing else changes.

## Acceptance checklist

Status as of 2026-07-12 (commits 9f5a532 → a82fb12):

- [x] `npm run lint` green; `npm test` — 88 passing incl. 24 new MCP tests (the only failures are
      the 2 pre-existing `localStorage` suite failures that exist on clean HEAD too).
- [x] `curl /.well-known/oauth-authorization-server` → 200, issuer correct.
- [x] `curl /.well-known/oauth-protected-resource/mcp` → 200 (note the `/mcp` path suffix — see
      Implementation deviations below).
- [x] Unauthenticated `POST /mcp` → 401 with `WWW-Authenticate` header pointing at PRM.
- [x] OAuth flow legs verified individually with curl: DCR `/register` 201, `/authorize` renders
      the dark login page with PKCE params round-tripped, wrong password → 401 inline error,
      unknown client / wrong redirect_uri → 400. (S256 verification is the SDK token handler's
      code path; exercised fully on first real connect.)
- [x] All 7 tools verified live via the SDK client (`StreamableHTTPClientTransport` + bearer
      token minted through the store): initialize, tools/list, every tool returns real data,
      not-found returns `isError`.
- [x] `mcp_audit_log` has one row per call, right `user_id`, durations sane; `isError` results
      recorded as errors.
- [x] SPA regression: `/`, `/api/health`, `/storage/...` all unaffected in dev.
- [x] Prod-mode check: `npm run build` + `NODE_ENV=production tsx server.ts` — `/mcp`,
      `/authorize`, `/.well-known/*` win over the SPA catch-all; deep links still serve the SPA.
- [ ] **Remaining (needs deployment / real credentials):** connect from claude.ai
      (custom connector `https://studio.minnagency.com/mcp`) and Claude Code
      (`claude mcp add --transport http minn …`) with a real browser login; verify rana's session
      attributes to rana; verify 1h token refresh rotation over a live connector.

## Implementation deviations from this spec (as built)

1. **PRM URL is path-suffixed**: the SDK serves protected-resource metadata at
   `/.well-known/oauth-protected-resource/mcp` (derived from `resourceServerUrl`), and
   `requireBearerAuth` advertises that URL. The spec above originally said the un-suffixed path.
2. **Client secrets are stored raw** inside `oauth_clients.metadata` (full DCR JSON round-trip):
   the SDK's token-endpoint client auth compares the raw secret, so hashing would break
   confidential clients. claude.ai/Claude Code register as public PKCE clients (no secret), so
   nothing sensitive lands there. The `client_secret_hash` column exists but is unused.
3. **`rotateRefreshToken(raw, expectedClientId?)`** also enforces pair↔client ownership.
4. **Audit wrapper flags `isError` tool results** as `status='error'`, not just thrown exceptions.
5. **DNS-rebinding transport options not used** — deprecated in SDK 1.29 (external middleware is
   the recommended path); every request is bearer-authenticated, which is the real guard.
6. **Express-4/5 fallback not needed** — `mcpAuthRouter` works as-is inside the Express 4 app
   (verified: metadata, DCR, authorize, token error paths).

## Rollback

Everything is additive. To roll back: remove the `mountMcp` lines from `server.ts`, delete
`backend/mcp/`, uninstall the SDK. The four new tables can stay (harmless) or be dropped:
`DROP TABLE oauth_clients; DROP TABLE oauth_authorization_codes; DROP TABLE oauth_tokens; DROP TABLE mcp_audit_log;`
No existing table or route is modified in this phase.
