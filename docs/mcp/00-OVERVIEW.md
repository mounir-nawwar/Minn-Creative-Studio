# MCP Connector — Overview

> **Read this file first.** It is the entry point for the entire MCP effort. Each phase has its own
> execution doc (`PHASE-A.md` … `PHASE-F.md`) written so a **fresh Claude session with zero prior
> context can execute that phase cold**: read this overview, read the phase doc, verify the listed
> assumptions still hold in the code, then implement. The **status tracker** below is the single
> source of truth for what is done.

## What we are building

A **remote MCP server** built into Minn Creative Studio so that Claude — from claude.ai, Claude
Desktop, the mobile app, or Claude Code — can operate the studio: list projects, search the Library,
generate text/images/video/audio with full parameter control (seeds, aspect ratios, negative
prompts, reference images), **build node graphs that appear in the Canvas UI**, and eventually run
whole pipelines headlessly and stream progress live into the canvas.

"Connector" is claude.ai's product name for a remote MCP server. There is one implementation; it
serves every Claude surface.

## Architecture

```
Claude client (claude.ai / Desktop / phone / Claude Code)
      │  HTTPS (OAuth 2.1 Bearer token)
      ▼
Cloudflare (studio.minnagency.com — TLS, proxy, ~100s response timeout)
      │  HTTP :3000
      ▼
Express app (server.ts — the ONE existing Node process, pm2 "minn-studio")
      ├─ /api/*            existing REST API (unchanged)
      ├─ /storage/*        existing static media (unchanged)
      ├─ /.well-known/*    OAuth metadata (NEW — RFC 8414 + RFC 9728)
      ├─ /authorize /token /register /revoke   OAuth 2.1 AS endpoints (NEW)
      ├─ /mcp/auth/login   login form POST target (NEW)
      ├─ /mcp              MCP Streamable HTTP endpoint (NEW)
      │       └─ backend/mcp/** → DIRECT imports of backend/services/*
      │          (database.ts, storage.ts, vertex service — no HTTP-to-self)
      └─ SPA catch-all (prod)  ← MCP/OAuth routes MUST be mounted before this
```

Key properties:

- **Same process.** The MCP layer imports `backend/services/database.ts`, `backend/services/storage.ts`,
  etc. directly. No second server, no port, no HTTP round-trips to itself. It rides the existing
  pm2 + Cloudflare deployment untouched.
- **Per-user identity.** Connecting Claude requires logging in as `mounir.nawwar` or `rana.tadmori`
  through an OAuth login page. Every tool call, asset, and dollar of Vertex cost is attributed to
  the real person. There is **no** service/agent user.
- **Everything audited.** Every tool call writes a row to `mcp_audit_log` (who, which tool, params
  truncated to 4 KB, ok/error, duration).
- **Writes tagged.** From Phase B on, anything MCP creates carries `{ via: 'mcp' }` in its
  `metadata` JSON where the schema has one (assets, usage_logs), so MCP-made content is always
  distinguishable in the UI/DB.

## Auth design (OAuth 2.1)

claude.ai custom connectors require a spec-compliant OAuth 2.1 authorization server with **PKCE
(S256)** and **Dynamic Client Registration** (RFC 7591). We implement it with the MCP SDK's server
auth framework rather than hand-rolling:

- `mcpAuthRouter({ provider, issuerUrl, ... })` from `@modelcontextprotocol/sdk` serves
  `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/authorize`,
  `/token`, `/register`, `/revoke` — with PKCE verification and per-endpoint rate limiting built in.
- We implement only **`MinnOAuthProvider`** (`backend/mcp/auth/provider.ts`) — ~7 methods over a
  SQLite store — and the **login page**.

Token model:

| Property | Choice |
|---|---|
| Format | Opaque random (`crypto.randomBytes(32)` → base64url), prefixes `mcp_at_` / `mcp_rt_` |
| At rest | **SHA-256 hash only** — raw tokens and raw auth codes are never stored |
| Access TTL | 1 hour |
| Refresh TTL | 30 days, **rotated on every use** (old refresh revoked, new pair issued) |
| Revocation | `/revoke` endpoint + pair-level revocation; deleting rows kills sessions |
| Attribution | `verifyAccessToken` returns `AuthInfo` with `extra: { userId, username }` |

Full connect flow (what actually happens when someone adds the connector):

1. Claude POSTs to `/mcp` with no token → `401` + `WWW-Authenticate: Bearer resource_metadata="…"`.
2. Claude fetches `/.well-known/oauth-protected-resource` → discovers the authorization server.
3. Claude fetches `/.well-known/oauth-authorization-server` → endpoints + capabilities.
4. Claude POSTs `/register` (DCR) → we store the client (name, redirect_uris) in `oauth_clients`.
5. Claude opens the browser at `/authorize?client_id&redirect_uri&code_challenge&state&…` →
   the SDK validates client + redirect, then our provider renders the **dark login page**
   (bg `#0a0a0a`, teal `#0097A7`, shows client name + requested scopes).
6. User submits credentials → `POST /mcp/auth/login` (rate-limited 5/15min) → verified via the
   existing timing-safe `login()` from `backend/services/auth.ts` → server re-validates
   client_id/redirect_uri against the store → single-use 10-min auth code issued → `302` back to
   Claude's `redirect_uri?code&state`.
7. Claude POSTs `/token` with the `code_verifier` → SDK checks S256 challenge → provider issues the
   opaque access+refresh pair.
8. Claude calls `/mcp` `initialize` with `Authorization: Bearer mcp_at_…` → session established.

## Transport design

- **Streamable HTTP** (`StreamableHTTPServerTransport`), **stateful**: a `Map<sessionId, {transport,
  user, lastSeen}>`; new transport per `initialize`, reused via the `mcp-session-id` header.
- **`enableJsonResponse: true`** (Phases A–D): every POST gets a plain `application/json` response.
  No SSE → no Cloudflare buffering concerns, and every tool call fits well inside Cloudflare's
  ~100s response window. `GET /mcp` (standalone SSE stream) returns **405** until Phase E.
- **Long-running work never blocks a request.** Video/Lyria-Pro (minutes) are exposed as
  `start_*_job` / `check_job` tool pairs (Phase B), mirroring the client-side `getOperation`
  polling the frontend already does.
- Session↔user binding: a request presenting session X with a token belonging to a different user
  gets `403`. Idle sessions are closed after 30 min by a sweeper.
- Body parsing: the app's global `express.json({ limit: '50mb' })` has already consumed the body, so
  every handler calls `transport.handleRequest(req, res, req.body)` (three-arg form). This is
  load-bearing — forgetting the third argument hangs requests.

## Phase roadmap

| Phase | Doc | One-liner |
|---|---|---|
| A | [PHASE-A.md](./PHASE-A.md) | `/mcp` endpoint + OAuth 2.1 + audit log + 7 read-only tools |
| B | [PHASE-B.md](./PHASE-B.md) | Creation tools: generate text/image/audio inline, video via job pattern, asset upload/move, chat access |
| C | [PHASE-C.md](./PHASE-C.md) | Graph tools: node schemas generated from the real registry; build/edit workflows that appear in the Canvas |
| D | [PHASE-D.md](./PHASE-D.md) | Headless graph runner: execute whole pipelines server-side |
| E | [PHASE-E.md](./PHASE-E.md) | Live canvas sync: watch Claude build in real time |
| F | [PHASE-F.md](./PHASE-F.md) | Hardening: scopes, rate limits, audit retention, tests, onboarding runbook |

## Status tracker

> Update this table at the end of every phase (or sub-milestone). This is the compaction-proof
> record of progress.

| Phase | Status | Commit(s) | Date | Notes |
|---|---|---|---|---|
| 0 — Spec & docs | ✅ done | d11ca0d | 2026-07-12 | |
| A — Skeleton + OAuth + read-only tools | ✅ done (local) | 9f5a532, f025912, 02c6e29, a82fb12 | 2026-07-12 | Verified locally end-to-end (SDK client, all 7 tools, audit rows, prod-mode route precedence). Remaining: deploy to VPS + connect from claude.ai/Claude Code with real login (see PHASE-A acceptance) |
| B — Creation tools | ✅ done | c770c19, 84bca09, 4f76730, 6fb2cf5, 063778a | 2026-07-12 | 20 tools total. Live-verified: text + gemini-image gen via MCP with via:mcp tagging + costs. Note: Imagen 4 returns Vertex 404 on the current GCP project (not allowlisted) — Gemini image models work. Video/music job pair code-complete, not yet exercised end-to-end (costs) |
| C — Graph tools | ✅ done | 684df3b, 06caa84 | 2026-07-13 | 30 tools total. Validator mirrors the canvas one-for-one (same registries imported from src). Live-verified: 6-node pipeline built via set_workflow + add_node/connect_nodes, guardrails reject blocked/mismatch/duplicate/cycle, auto-layout works. Canvas concurrency remains last-writer-wins until Phase E |
| D — Headless runner | ✅ done | 0785a54 | 2026-07-13 | 33 tools. Live-verified: 6-node pipeline run headlessly (prompt+seed → gemini image → describer → output), outputs written into the graph, `crop` correctly skipped, costs tracked. Pixel nodes have no server executor by design |
| E — Live canvas sync | ⬜ not started | | | |
| F — Hardening & onboarding | ⬜ not started | | | |

## Decisions log

| # | Decision | Rationale | Date |
|---|---|---|---|
| 1 | Mount MCP **inside the existing Express app** at `/mcp` (same process) | Direct service imports, zero new infra, rides pm2/Cloudflare; a 2-user tool doesn't need a microservice | 2026-07-11 |
| 2 | Use the **SDK auth framework** (`mcpAuthRouter` + custom `OAuthServerProvider` + `requireBearerAuth`), not a hand-rolled AS | Spec-correct metadata/PKCE/DCR/rate-limits for free; we only write the provider + login page. Fallback documented in PHASE-A if the Express-5-based router misbehaves under Express 4 | 2026-07-11 |
| 3 | **Opaque tokens, SHA-256 hashed at rest**, 1h access / 30d rotating refresh | Simple revocation, nothing usable leaks from a DB backup; JWT would complicate revocation | 2026-07-11 |
| 4 | **Per-user OAuth login** (mounir/rana), no third "agent" user | True attribution of cost/assets; `{via:'mcp'}` metadata tag covers "what did Claude make" | 2026-07-11 |
| 5 | **`enableJsonResponse: true`**, GET SSE = 405, long ops = job-pattern tools | Cloudflare ~100s timeout + SSE buffering; JSON mode sidesteps both until Phase E needs streaming | 2026-07-11 |
| 6 | Every tool call wrapped in **`auditToolCall`** → `mcp_audit_log` | Two-person shared tool + a remote agent = must be able to answer "who/what/when" | 2026-07-11 |
| 7 | SDK pinned **exactly** (`@modelcontextprotocol/sdk@1.29.0`, no caret) | The server-auth API surface has shifted between minors; upgrades are deliberate, tested events | 2026-07-11 |
| 8 | Zod: repo's **zod ^4.4.3 is compatible** — SDK 1.29 declares `zod: "^3.25 \|\| ^4.0"` | Verified via `npm view`; no alias/downgrade needed | 2026-07-11 |
| 9 | `list_models` **imports `src/lib/models.ts` directly** from backend code | Verified backend-safe (only imports pure-data `src/nodes/imagenModels.ts`); tsx loads it fine. A unit test imports it under Node to catch regressions | 2026-07-11 |
| 10 | New env var **`PUBLIC_BASE_URL`** (e.g. `https://studio.minnagency.com`) | OAuth issuer/resource metadata needs the public origin; none existed | 2026-07-11 |

## Glossary

- **MCP** — Model Context Protocol; the open protocol Claude uses to call external tools.
- **Streamable HTTP** — MCP's current remote transport: JSON-RPC over POST to one endpoint,
  optional SSE streaming, `mcp-session-id` header for session affinity.
- **Connector** — claude.ai's name for a remote MCP server added by URL.
- **DCR** — Dynamic Client Registration (RFC 7591): clients self-register via `POST /register`;
  required by claude.ai (you can't pre-register its client).
- **PKCE** — Proof Key for Code Exchange (RFC 7636, S256): binds the auth code to the client that
  requested it; mandatory in OAuth 2.1.
- **PRM** — Protected Resource Metadata (RFC 9728): `/.well-known/oauth-protected-resource`, how a
  client discovers which AS protects `/mcp`.
- **AuthInfo** — the SDK's verified-token object attached to `req.auth`; our provider puts
  `{ userId, username }` in `AuthInfo.extra`.
- **Session** — one MCP client connection (an `initialize` handshake); maps to one
  `StreamableHTTPServerTransport` + one `McpServer` instance bound to one user.
- **LRO** — long-running operation (Veo video, Lyria-Pro audio); exposed as start/check job tools.
- **Playground sentinel** — the hidden shared project `id='playground'`; excluded from
  `projects.findAll()`, must stay hidden/un-editable (see CLAUDE.md).

## Ground rules for every phase

1. **Verify before you build.** Phase docs cite file paths + line numbers as of 2026-07-11; re-grep
   before relying on them.
2. **Don't fork logic.** Reuse `backend/services/*` and existing repos (`projects`, `workflows`,
   `assets`, `usageLogs`, `chatPresets`). If the proxy does it, refactor the proxy into a callable
   service — never duplicate Vertex code.
3. **Don't break the app.** The SPA, `/api`, `/storage`, login page, playground sentinel, and
   shared-workspace semantics are untouchable. MCP is additive.
4. **Cost tracking is mandatory.** Anything that calls a paid model flows through
   `trackProjectCost` (this happens automatically if you reuse the proxy/service layer).
5. **Conventional commits**, batched per coherent chunk, no push without explicit ask.
6. **Update the status tracker** in this file when a phase (or notable milestone) lands.
