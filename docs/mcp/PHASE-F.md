# Phase F — Hardening & onboarding

> Status: ✅ complete (2026-07-13, commits e6a0348 + 52ce896). This doc is now
> the **operating manual** for the connector: what protects it, and how to connect,
> revoke, and troubleshoot it.

## What shipped

### 1. Scopes

Three scopes, enforced centrally in `backend/mcp/guard.ts` (never per-tool ad hoc):

| Scope | Grants | Examples |
|---|---|---|
| `read` | Look at anything | `list_projects`, `search_library`, `get_workflow`, `check_job`, `get_audit_log` |
| `write` | Change app data (free) | `set_workflow`, `add_node`, `move_asset`, `create_chat`, `cancel_run` |
| `generate` | **Spend Vertex credit** | `generate_image`, `start_video_job`, `run_workflow`, `run_node` |

- Advertised via `scopesSupported` in the OAuth metadata; the login page spells out in
  plain language what it is granting ("generate images, video, audio, and text — this spends
  Vertex credit").
- **Scopes are resolved from the verified access token** (registered by the transport at
  `initialize`), never from anything the caller asserts. A session for the same user with different
  scopes cannot leak permissions into another.
- Unlisted tools default to `read` (least privilege).
- **Legacy grandfathering:** tokens issued before this phase carry `scope=read` (the only scope
  advertised then). Enforcing that literally would have silently broken the live connector, so a
  token whose scopes are exactly `['read']` is granted the full set. New connections receive
  explicit scopes. Consequence: a genuinely read-only connection isn't expressible until those
  tokens age out (≤30d) — acceptable for a two-person tool, and noted here so it isn't mistaken for
  a bug.

### 2. Rate limits & spend ceiling

Per user, in memory (two users — no Redis):

| Guard | Default | Env |
|---|---|---|
| Tool calls / minute | 120 | — |
| **Generation** calls / minute | 10 | — |
| Daily spend ceiling | **$20** | `MCP_DAILY_SPEND_LIMIT_USD` |
| Max estimated cost of one workflow run | **$5** (needs `confirmCost: true` above it) | `MCP_MAX_RUN_COST_USD` |
| Concurrent jobs per user | 3 (1 for workflow runs) | — |

The spend ceiling counts **all** of a user's Vertex spend today (app + connector), read from
`usage_logs`. Refusals are returned as readable tool errors ("Daily spend limit reached: $20.14 of
$20.00 used today…"), and are themselves audited.

### 3. Audit lifecycle

- Every tool call — including refusals — lands in `mcp_audit_log` (who, tool, params truncated to
  4 KB, ok/error, duration).
- Pruned at **90 days**, at boot and daily thereafter (`auditLog.startRetentionSweep()`).
- Readable through the connector: **`get_audit_log`** (filter by user, tool, status, since) and
  **`get_connector_status`** (this connection's scopes, today's spend vs the ceiling, active limits).

### 4. E2E harness — the SDK-upgrade gate

`backend/mcp/__tests__/e2e.test.ts` boots the **real** Express app on an ephemeral port
(`createApp({ serveFrontend: false })`, now exported from `server.ts`) and drives it with the **real**
MCP SDK client over Streamable HTTP:

- OAuth metadata discovery (AS + protected-resource) and the 401 `WWW-Authenticate` challenge
- Bad-token rejection
- Full handshake, tool listing, and every tool exposing a renderable input schema
- Read-only tool calls returning real data, with audit-row assertions
- Tool-level error results (missing project) rather than protocol failures
- **Live scope enforcement** (a `read write` token is refused `generate_image`)

Nothing in it spends money. **Run it before bumping `@modelcontextprotocol/sdk` (pinned `1.29.0`).**

---

## Runbook — connecting Claude

Each person connects with **their own** Minn credentials; everything they do is attributed and
audited as them.

### claude.ai (web, desktop app, and mobile — one setup covers all three)
1. Settings → **Connectors** → **Add custom connector**
2. URL: `https://studio.minnagency.com/mcp`
3. The dark "Connect Claude to Minn Creative Studio" page opens → sign in (e.g. `mounir.nawwar`)
4. Done — the tools appear in any chat. The mobile app picks it up from the same account.

### Claude Code
```bash
claude mcp add --transport http minn https://studio.minnagency.com/mcp   # add --scope user for all projects
/mcp        # then authenticate in the browser window it opens
```
Restart Claude Code after connecting so it picks up the tool list.

### Verifying a connection
Ask: *"Using minn, what's my connector status?"* → `get_connector_status` returns your scopes,
today's spend, and the limits in force.

### Revoking
- **Client side:** delete the connector (claude.ai) or `claude mcp remove minn` (Claude Code).
- **Server side** (kills the token immediately, e.g. a lost laptop):
  ```bash
  ssh minn-oracle
  cd ~/Minn-Creative-Studio
  sqlite3 data/minn-studio.db "UPDATE oauth_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = (SELECT id FROM users WHERE username='mounir.nawwar');"
  ```
  The next tool call fails auth and the client re-prompts for login.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Login page loops / 401 after connecting | `PUBLIC_BASE_URL` wrong on the VPS, so issuer ≠ actual origin | Fix `.env`, `pm2 restart minn-studio --update-env` |
| "does not have 'generate' permission" | Connection granted fewer scopes | Reconnect the connector |
| "Rate limit reached" | >10 generations or >120 calls in a minute | Wait the stated seconds |
| "Daily spend limit reached" | $20 of Vertex credit used today (app + MCP) | Wait, or raise `MCP_DAILY_SPEND_LIMIT_USD` |
| "This run is estimated at $X, above the ceiling" | Expensive pipeline | Have Claude re-run with `confirmCost: true`, or trim the plan |
| Tools missing after an update | Client cached the old tool list | Restart the Claude client |
| Imagen 4 → `NOT_FOUND` | Imagen not enabled on the GCP project | Use a Gemini image model (`gemini-3.1-flash-image-preview`) |
| Workflow run says "Interrupted by a server restart" | pm2 restarted mid-run (runner state is in-process) | Re-run it |

---

## Rollback

All additive. Disabling enforcement = stop calling `guard()` (revert to `auditLog.wrap`); the tables
and tools can stay. Scopes soft-fail open for legacy tokens by design.
