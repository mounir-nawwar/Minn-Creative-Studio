/**
 * MCP audit log — every tool call is recorded: who ran what, with which params
 * (truncated), whether it succeeded, and how long it took. This is the answer
 * to "what did Claude do in our studio last week?".
 */

import { db } from '../services/database.ts';
import { MAX_AUDIT_PARAM_BYTES } from './config.ts';

type SqliteDb = typeof db;

/** How long tool-call history is kept. */
const RETENTION_DAYS = 90;
const RETENTION_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface AuditQuery {
  userId?: string;
  tool?: string;
  status?: 'ok' | 'error';
  since?: string;
  limit?: number;
}

export interface AuditContext {
  userId: string;
  sessionId?: string;
}

function truncateParams(params: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(params ?? {});
  } catch {
    json = '"<unserializable>"';
  }
  if (Buffer.byteLength(json, 'utf8') <= MAX_AUDIT_PARAM_BYTES) return json;
  // Byte-safe truncation; the stored value is a marker string, not valid JSON,
  // which is fine — the column is for humans investigating, not for parsing.
  const sliced = Buffer.from(json, 'utf8').subarray(0, MAX_AUDIT_PARAM_BYTES).toString('utf8');
  return `${sliced}…[truncated]`;
}

export function createAuditLog(database: SqliteDb) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS mcp_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_id TEXT,
      tool TEXT NOT NULL,
      params TEXT DEFAULT '{}',
      status TEXT NOT NULL CHECK(status IN ('ok','error')),
      error TEXT,
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_audit_created ON mcp_audit_log(created_at);
  `);

  const insert = database.prepare(`
    INSERT INTO mcp_audit_log (user_id, session_id, tool, params, status, error, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  return {
    record(args: {
      userId: string;
      sessionId?: string;
      tool: string;
      params: unknown;
      status: 'ok' | 'error';
      error?: string;
      durationMs: number;
    }): void {
      try {
        insert.run(
          args.userId,
          args.sessionId ?? null,
          args.tool,
          truncateParams(args.params),
          args.status,
          args.error ?? null,
          Math.round(args.durationMs)
        );
      } catch (err: unknown) {
        // Auditing must never take a tool call down with it.
        console.error('[MCP] Failed to write audit log row:', err);
      }
    },

    /** Recent tool calls, newest first (powers the get_audit_log tool). */
    query(filters: AuditQuery = {}) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (filters.userId) { conditions.push('user_id = ?'); params.push(filters.userId); }
      if (filters.tool) { conditions.push('tool = ?'); params.push(filters.tool); }
      if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }
      if (filters.since) { conditions.push('created_at >= ?'); params.push(filters.since); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
      return database
        .prepare(`SELECT id, user_id, session_id, tool, params, status, error, duration_ms, created_at
                  FROM mcp_audit_log ${where} ORDER BY id DESC LIMIT ?`)
        .all(...params, limit) as Array<Record<string, unknown>>;
    },

    /** Drop history older than the retention window. */
    prune(): number {
      const result = database
        .prepare(`DELETE FROM mcp_audit_log WHERE created_at < datetime('now', '-${RETENTION_DAYS} days')`)
        .run();
      if (result.changes > 0) console.log(`[MCP] Pruned ${result.changes} audit row(s) older than ${RETENTION_DAYS} days`);
      return result.changes;
    },

    /** Prune at boot, then daily. No cron on the VPS — an interval is enough. */
    startRetentionSweep(): void {
      this.prune();
      const timer = setInterval(() => this.prune(), RETENTION_SWEEP_INTERVAL_MS);
      timer.unref();
    },

    /**
     * Wrap a tool handler: times it, records ok/error, rethrows the original
     * error. Results shaped like a CallToolResult with `isError: true` (the
     * MCP way of reporting tool-level failures without throwing) are recorded
     * as errors too.
     */
    async wrap<T>(ctx: AuditContext, tool: string, params: unknown, fn: () => Promise<T>): Promise<T> {
      const started = Date.now();
      try {
        const result = await fn();
        const asToolResult = result as { isError?: boolean; content?: Array<{ text?: string }> } | null;
        if (asToolResult && asToolResult.isError === true) {
          const message = asToolResult.content?.[0]?.text?.slice(0, 200) ?? 'Tool returned an error result';
          this.record({ ...ctx, tool, params, status: 'error', error: message, durationMs: Date.now() - started });
        } else {
          this.record({ ...ctx, tool, params, status: 'ok', durationMs: Date.now() - started });
        }
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.record({ ...ctx, tool, params, status: 'error', error: message, durationMs: Date.now() - started });
        throw err;
      }
    },
  };
}

export type AuditLog = ReturnType<typeof createAuditLog>;

/** App-wide audit log bound to the shared SQLite database (creates the table on import). */
export const auditLog = createAuditLog(db);
