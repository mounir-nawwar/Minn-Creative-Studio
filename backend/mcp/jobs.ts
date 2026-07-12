/**
 * MCP job store — persistence for long-running generations (Veo video,
 * Lyria-Pro audio) started through the connector.
 *
 * MCP tools must respond fast (Cloudflare ~100s), so `start_*_job` returns a
 * job id immediately and `check_job` polls. Jobs live in SQLite (not memory)
 * so a pm2 restart mid-render doesn't orphan the Vertex operation — the
 * operation name survives and polling picks the result up after the restart.
 */

import { db, generateId } from '../services/database.ts';

type SqliteDb = typeof db;

export type McpJobKind = 'video' | 'audio';
export type McpJobStatus = 'running' | 'done' | 'error';

export interface McpJob {
  id: string;
  user_id: string;
  project_id: string;
  kind: McpJobKind;
  operation_name: string;
  model: string | null;
  /** Context needed to poll/finish: { config, prompt, … } */
  params: Record<string, unknown>;
  status: McpJobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createJobStore(database: SqliteDb) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS mcp_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('video','audio')),
      operation_name TEXT NOT NULL,
      model TEXT,
      params TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','done','error')),
      result TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_jobs_user ON mcp_jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_jobs_status ON mcp_jobs(status);
  `);

  function rowToJob(row: any): McpJob | undefined {
    if (!row) return undefined;
    return {
      ...row,
      params: parseJson(row.params, {}),
      result: parseJson(row.result, null),
    };
  }

  return {
    createJob(args: {
      userId: string;
      projectId: string;
      kind: McpJobKind;
      operationName: string;
      model?: string;
      params?: Record<string, unknown>;
    }): string {
      const id = generateId();
      database
        .prepare(`
          INSERT INTO mcp_jobs (id, user_id, project_id, kind, operation_name, model, params)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(id, args.userId, args.projectId, args.kind, args.operationName, args.model ?? null, JSON.stringify(args.params ?? {}));
      return id;
    },

    getJob(id: string): McpJob | undefined {
      return rowToJob(database.prepare('SELECT * FROM mcp_jobs WHERE id = ?').get(id));
    },

    /** Terminal + idempotent: once done, repeated check_job calls reuse the stored result. */
    markDone(id: string, result: Record<string, unknown>): void {
      database
        .prepare(`UPDATE mcp_jobs SET status = 'done', result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(JSON.stringify(result), id);
    },

    markError(id: string, error: string): void {
      database
        .prepare(`UPDATE mcp_jobs SET status = 'error', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(error, id);
    },

    /** How many jobs a user currently has in flight (used for a sanity cap). */
    countRunning(userId: string): number {
      const row = database
        .prepare(`SELECT COUNT(*) as n FROM mcp_jobs WHERE user_id = ? AND status = 'running'`)
        .get(userId) as { n: number };
      return row.n;
    },
  };
}

export type JobStore = ReturnType<typeof createJobStore>;

/** App-wide job store bound to the shared SQLite database (creates the table on import). */
export const jobStore = createJobStore(db);
