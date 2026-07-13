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

export type McpJobKind = 'video' | 'audio' | 'workflow';
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

const CREATE_JOBS_TABLE = `
  CREATE TABLE IF NOT EXISTS mcp_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('video','audio','workflow')),
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
`;

/**
 * Phase B shipped the table with CHECK(kind IN ('video','audio')). A CHECK
 * can't be ALTERed in SQLite, so widen it by rebuilding once (rows preserved).
 */
function migrateJobKinds(database: SqliteDb): void {
  const existing = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='mcp_jobs'")
    .get() as { sql?: string } | undefined;
  if (!existing?.sql || existing.sql.includes("'workflow'")) return;

  database.exec(`
    ALTER TABLE mcp_jobs RENAME TO mcp_jobs_legacy;
    ${CREATE_JOBS_TABLE}
    INSERT INTO mcp_jobs (id, user_id, project_id, kind, operation_name, model, params, status, result, error, created_at, updated_at)
      SELECT id, user_id, project_id, kind, operation_name, model, params, status, result, error, created_at, updated_at
      FROM mcp_jobs_legacy;
    DROP TABLE mcp_jobs_legacy;
  `);
  console.log("[MCP] Migrated mcp_jobs: kind now allows 'workflow'");
}

export function createJobStore(database: SqliteDb) {
  database.exec(CREATE_JOBS_TABLE);
  migrateJobKinds(database);

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

    countRunningOfKind(userId: string, kind: McpJobKind): number {
      const row = database
        .prepare(`SELECT COUNT(*) as n FROM mcp_jobs WHERE user_id = ? AND kind = ? AND status = 'running'`)
        .get(userId, kind) as { n: number };
      return row.n;
    },

    /** Live progress for a running job (workflow runs report per-node results here). */
    updateProgress(id: string, progress: Record<string, unknown>): void {
      database
        .prepare(`UPDATE mcp_jobs SET result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'`)
        .run(JSON.stringify(progress), id);
    },

    /**
     * Runner state lives in memory, so a process restart orphans any 'running'
     * job. Fail them at boot rather than leaving check_job polling forever.
     * (Video/audio jobs are Vertex-side and recoverable — only workflow runs,
     * which we drive ourselves, are truly lost.)
     */
    failInterruptedRuns(): number {
      const result = database
        .prepare(`UPDATE mcp_jobs SET status = 'error', error = 'Interrupted by a server restart', updated_at = CURRENT_TIMESTAMP
                  WHERE kind = 'workflow' AND status = 'running'`)
        .run();
      if (result.changes > 0) console.log(`[MCP] Marked ${result.changes} interrupted workflow run(s) as failed`);
      return result.changes;
    },
  };
}

export type JobStore = ReturnType<typeof createJobStore>;

/** App-wide job store bound to the shared SQLite database (creates the table on import). */
export const jobStore = createJobStore(db);
