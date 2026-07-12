# Phase F — Hardening & onboarding

> Execution doc. Prerequisite: whichever phases are live (applies to all shipped tools).
> Design written 2026-07-11.

## Objective

Turn the connector from "works" into "operated": scopes, rate limits, audit lifecycle, a real test
harness, and a runbook so connecting a new Claude surface takes 5 minutes.

## 1. Scopes

Three scopes, enforced centrally (not per-tool ad hoc):

| Scope | Grants |
|---|---|
| `read` | Phase A tools |
| `write` | Graph tools, asset move/upload, chat tools |
| `generate` | Everything that costs money (generate_*, start_*_job, run_workflow) |

- `mcpAuthRouter({ scopesSupported: ['read','write','generate'] })`; login/consent page gains
  checkboxes (default all checked) → granted scopes stored on the token pair.
- Each tool declares its required scope in registration metadata; a single wrapper (extend
  `auditToolCall` → `guardedToolCall`) rejects with a clear "re-connect and grant X" message.
- `requireBearerAuth({ requiredScopes: ['read'] })` stays minimal; fine-grained checks in the wrapper.

## 2. Rate limits & quotas

- Per-user tool-call limiter (in `guardedToolCall`): e.g. 120 calls/min overall, 10/min for
  `generate` scope tools. In-memory counters keyed by userId (2 users; no Redis).
- Daily spend ceiling per user via `usage_logs` query (`MCP_DAILY_SPEND_LIMIT_USD`, default $20):
  `generate` tools refuse when exceeded, message includes today's total.
- Keep the SDK's built-in OAuth-endpoint limits + `loginLimiter` (Phase A) as-is.

## 3. Audit lifecycle & observability

- Retention: nightly prune of `mcp_audit_log` older than 90 days (setInterval on boot — no cron
  infra on the VPS).
- `get_audit_log` admin tool (both users may read — it's a 2-person shop): filters
  `{ userId?, tool?, since?, limit }`.
- Boot log line: `[MCP] mounted at /mcp — N tools, issuer <PUBLIC_BASE_URL>`.
- Optional Library/UI badge for `via:'mcp'` assets (nice-to-have; decide when here).

## 4. Test harness

- **Integration suite** (`backend/mcp/__tests__/e2e.test.ts`): boot the Express app in-process
  (export `createApp()` from server.ts if needed — small refactor), then drive the real HTTP
  surface with `@modelcontextprotocol/sdk` **client** + `StreamableHTTPClientTransport` against
  `http://127.0.0.1:<ephemeral>`: full OAuth (programmatic form POST) → initialize → list tools →
  call each read tool → assert audit rows. This is the regression net for SDK upgrades.
- Keep the SDK pinned; upgrades happen by bumping the pin + running this suite.
- Load-ish check: 50 sequential tool calls < 10s locally (SQLite is sync — watch event-loop stalls).

## 5. Onboarding runbook (write into this file's appendix when Phase F lands)

Per surface, exact clicks:
- **claude.ai (web/mobile)**: Settings → Connectors → Add custom connector →
  `https://studio.minnagency.com/mcp` → browser login page → grant scopes. Note: each user
  connects with their own Minn credentials.
- **Claude Desktop**: same connector directory (synced from claude.ai account).
- **Claude Code**: `claude mcp add --transport http minn https://studio.minnagency.com/mcp`
  (project or user scope), then `/mcp` to authenticate.
- **Revoking**: delete the connector client-side AND (optional) revoke server-side —
  `DELETE FROM oauth_tokens WHERE user_id = ?` (or a small `revoke_my_tokens` tool).
- Troubleshooting table: 401 loops (clock skew, stale PUBLIC_BASE_URL), Cloudflare 52x on
  `/token` (rate limit), "tool not allowed" (missing scope → reconnect).

## Acceptance checklist

- [ ] Token granted `read`-only: generate tools refuse with the reconnect message.
- [ ] 11th generate call in a minute is rate-limited; message names the limit.
- [ ] Spend ceiling triggers (set limit to $0.01 locally, run one generation, next refuses).
- [ ] Audit prune removes >90d rows, keeps newer.
- [ ] E2E suite green in CI-less local run (`npm test`); documented as the SDK-upgrade gate.
- [ ] Runbook appendix written and verified by actually connecting one fresh surface per entry.

## Rollback

All additive wrappers/config. Scopes can be soft-launched: enforce only when the token carries a
scopes claim; legacy Phase A–E tokens (pre-scopes) default to all scopes until they expire (≤30d).
