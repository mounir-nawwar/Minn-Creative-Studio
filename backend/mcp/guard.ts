/**
 * Tool-call policy: scopes, rate limits, and the daily spend ceiling.
 *
 * Every tool handler runs inside `guard(...)`, which enforces (in order):
 *   1. **Scope** — does this connection have permission for this class of tool?
 *   2. **Rate limit** — per-user calls/minute (tighter for paid tools).
 *   3. **Spend ceiling** — today's Vertex spend for this user.
 * …then hands off to the audit log, so a rejected call is still recorded.
 *
 * Scopes are resolved from the session's access token (registered by the
 * transport at initialize), not from anything the caller can assert.
 */

import { db } from '../services/database.ts';
import { auditLog, type AuditContext } from './audit.ts';
import { errorResult } from './tools/util.ts';

export const SCOPES = ['read', 'write', 'generate'] as const;
export type Scope = (typeof SCOPES)[number];

/** Which scope each tool needs. Anything unlisted defaults to `read`. */
const TOOL_SCOPES: Record<string, Scope> = {
  // read
  list_projects: 'read', get_project: 'read', get_usage_summary: 'read',
  list_workflows: 'read', get_workflow: 'read', validate_workflow: 'read',
  search_library: 'read', list_models: 'read', describe_node_types: 'read',
  list_chats: 'read', get_chat: 'read', check_job: 'read',
  get_audit_log: 'read', get_connector_status: 'read',

  // write (mutates app data, costs nothing)
  create_project: 'write', update_project: 'write',
  create_workflow: 'write', add_node: 'write', update_node: 'write', remove_node: 'write',
  connect_nodes: 'write', disconnect_nodes: 'write', set_workflow: 'write', auto_layout: 'write',
  create_chat: 'write', post_chat_message: 'write',
  move_asset: 'write', upload_asset_from_url: 'write', cancel_run: 'write',

  // generate (spends money)
  generate_text: 'generate', generate_image: 'generate', generate_speech: 'generate',
  generate_music_clip: 'generate', start_video_job: 'generate', start_music_job: 'generate',
  run_workflow: 'generate', run_node: 'generate',
};

export function scopeForTool(tool: string): Scope {
  return TOOL_SCOPES[tool] ?? 'read';
}

/* ------------------------------------------------------------------ *
 * Scope registry — populated from the verified token at session start
 * ------------------------------------------------------------------ */

const sessionScopes = new Map<string, Scope[]>();
const userScopes = new Map<string, Scope[]>();

/**
 * Tokens issued before scopes existed carry exactly `['read']` (that was the
 * only advertised scope). Treating them literally would silently break the
 * live connector, so they are grandfathered to full access until they expire
 * or the user reconnects. New connections get explicit scopes.
 */
function normalizeScopes(granted: string[] | undefined): Scope[] {
  const valid = (granted ?? []).filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));
  if (valid.length === 0) return [...SCOPES];
  if (valid.length === 1 && valid[0] === 'read') return [...SCOPES]; // legacy token
  return valid;
}

export function registerSessionScopes(sessionId: string | undefined, userId: string, granted: string[] | undefined): void {
  const scopes = normalizeScopes(granted);
  if (sessionId) sessionScopes.set(sessionId, scopes);
  userScopes.set(userId, scopes);
}

export function releaseSessionScopes(sessionId: string): void {
  sessionScopes.delete(sessionId);
}

function scopesFor(ctx: AuditContext): Scope[] {
  return (ctx.sessionId && sessionScopes.get(ctx.sessionId)) || userScopes.get(ctx.userId) || [...SCOPES];
}

/* ------------------------------------------------------------------ *
 * Rate limiting — per user, in memory (two users; no Redis needed)
 * ------------------------------------------------------------------ */

const WINDOW_MS = 60_000;
const MAX_CALLS_PER_MINUTE = 120;
const MAX_GENERATE_CALLS_PER_MINUTE = 10;

const callTimes = new Map<string, number[]>();

function hitRateLimit(userId: string, scope: Scope): string | null {
  const now = Date.now();
  const key = `${userId}:${scope === 'generate' ? 'generate' : 'all'}`;
  const limit = scope === 'generate' ? MAX_GENERATE_CALLS_PER_MINUTE : MAX_CALLS_PER_MINUTE;

  const recent = (callTimes.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    const retryInSeconds = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return `Rate limit reached (${limit} ${scope === 'generate' ? 'generation' : 'tool'} calls/minute). Try again in ${retryInSeconds}s.`;
  }
  recent.push(now);
  callTimes.set(key, recent);
  return null;
}

/* ------------------------------------------------------------------ *
 * Daily spend ceiling
 * ------------------------------------------------------------------ */

const DEFAULT_DAILY_SPEND_LIMIT_USD = 20;

function dailySpendLimit(): number {
  const configured = Number(process.env.MCP_DAILY_SPEND_LIMIT_USD);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_SPEND_LIMIT_USD;
}

/** Everything this user has spent today, through the app or the connector. */
export function spentTodayUsd(userId: string): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(cost), 0) AS total FROM usage_logs
              WHERE user_id = ? AND created_at >= date('now', 'start of day')`)
    .get(userId) as { total: number };
  return row.total ?? 0;
}

function hitSpendCeiling(userId: string): string | null {
  const limit = dailySpendLimit();
  const spent = spentTodayUsd(userId);
  if (spent < limit) return null;
  return `Daily spend limit reached: $${spent.toFixed(2)} of $${limit.toFixed(2)} used today. Generation is paused until tomorrow (raise MCP_DAILY_SPEND_LIMIT_USD to change this).`;
}

/* ------------------------------------------------------------------ *
 * The guard
 * ------------------------------------------------------------------ */

/**
 * Same call shape as auditLog.wrap — policy first, then audit. Rejections are
 * returned as MCP error results (and recorded), never thrown, so Claude gets a
 * message it can act on rather than a protocol failure.
 */
export async function guard<T>(ctx: AuditContext, tool: string, params: unknown, fn: () => Promise<T>): Promise<T> {
  const required = scopeForTool(tool);
  const granted = scopesFor(ctx);

  const deny = (message: string) =>
    auditLog.wrap(ctx, tool, params, async () => errorResult(message) as unknown as T);

  if (!granted.includes(required)) {
    return deny(
      `This connection does not have '${required}' permission (granted: ${granted.join(', ') || 'none'}). ` +
        'Reconnect the Minn connector and grant it to use this tool.'
    );
  }

  const limited = hitRateLimit(ctx.userId, required);
  if (limited) return deny(limited);

  if (required === 'generate') {
    const capped = hitSpendCeiling(ctx.userId);
    if (capped) return deny(capped);
  }

  return auditLog.wrap(ctx, tool, params, fn);
}
