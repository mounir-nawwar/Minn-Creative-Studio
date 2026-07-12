// @vitest-environment node
import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createAuditLog, type AuditLog } from '../audit.ts';
import { MAX_AUDIT_PARAM_BYTES } from '../config.ts';

describe('mcp audit log', () => {
  let db: InstanceType<typeof Database>;
  let audit: AuditLog;

  beforeEach(() => {
    db = new Database(':memory:');
    audit = createAuditLog(db as any);
  });

  const rows = () => db.prepare('SELECT * FROM mcp_audit_log ORDER BY id').all() as any[];

  test('successful calls are recorded and the result passes through', async () => {
    const result = await audit.wrap({ userId: 'user-1', sessionId: 's-1' }, 'list_projects', { a: 1 }, async () => 42);
    expect(result).toBe(42);

    const [row] = rows();
    expect(row.user_id).toBe('user-1');
    expect(row.session_id).toBe('s-1');
    expect(row.tool).toBe('list_projects');
    expect(row.status).toBe('ok');
    expect(row.error).toBeNull();
    expect(JSON.parse(row.params)).toEqual({ a: 1 });
    expect(row.duration_ms).toBeGreaterThanOrEqual(0);
  });

  test('failing calls are recorded as errors and rethrown', async () => {
    await expect(
      audit.wrap({ userId: 'user-1' }, 'get_project', { projectId: 'x' }, async () => {
        throw new Error('Project not found');
      })
    ).rejects.toThrow('Project not found');

    const [row] = rows();
    expect(row.status).toBe('error');
    expect(row.error).toBe('Project not found');
  });

  test('oversized params are truncated to the byte budget', async () => {
    const huge = { blob: 'x'.repeat(MAX_AUDIT_PARAM_BYTES * 3) };
    await audit.wrap({ userId: 'user-1' }, 'search_library', huge, async () => null);

    const [row] = rows();
    expect(Buffer.byteLength(row.params, 'utf8')).toBeLessThanOrEqual(MAX_AUDIT_PARAM_BYTES + 32);
    expect(row.params.endsWith('…[truncated]')).toBe(true);
  });

  test('unserializable params do not break the call', async () => {
    const circular: any = {};
    circular.self = circular;
    const result = await audit.wrap({ userId: 'user-1' }, 'list_models', circular, async () => 'ok');
    expect(result).toBe('ok');
    expect(rows()[0].params).toBe('"<unserializable>"');
  });
});
