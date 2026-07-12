// @vitest-environment node
import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createJobStore, type JobStore } from '../jobs.ts';

describe('mcp job store', () => {
  let store: JobStore;

  beforeEach(() => {
    store = createJobStore(new Database(':memory:') as any);
  });

  test('creates and reads back a running job with parsed params', () => {
    const id = store.createJob({
      userId: 'user-1', projectId: 'proj-1', kind: 'video',
      operationName: 'operations/abc', model: 'veo-3.1-fast-generate-001',
      params: { config: { durationSeconds: 6 }, prompt: 'a fox' },
    });
    const job = store.getJob(id);
    expect(job?.status).toBe('running');
    expect(job?.kind).toBe('video');
    expect(job?.operation_name).toBe('operations/abc');
    expect(job?.params).toEqual({ config: { durationSeconds: 6 }, prompt: 'a fox' });
    expect(job?.result).toBeNull();
  });

  test('markDone stores the result and is idempotent to re-read', () => {
    const id = store.createJob({ userId: 'u', projectId: 'p', kind: 'video', operationName: 'op' });
    store.markDone(id, { url: '/storage/x.mp4', assetId: 'a1' });
    expect(store.getJob(id)?.status).toBe('done');
    expect(store.getJob(id)?.result).toEqual({ url: '/storage/x.mp4', assetId: 'a1' });
  });

  test('markError stores the message', () => {
    const id = store.createJob({ userId: 'u', projectId: 'p', kind: 'audio', operationName: 'op' });
    store.markError(id, 'Vertex exploded');
    const job = store.getJob(id);
    expect(job?.status).toBe('error');
    expect(job?.error).toBe('Vertex exploded');
  });

  test('countRunning only counts in-flight jobs for that user', () => {
    store.createJob({ userId: 'u1', projectId: 'p', kind: 'video', operationName: 'op1' });
    const done = store.createJob({ userId: 'u1', projectId: 'p', kind: 'video', operationName: 'op2' });
    store.createJob({ userId: 'u2', projectId: 'p', kind: 'video', operationName: 'op3' });
    store.markDone(done, {});
    expect(store.countRunning('u1')).toBe(1);
    expect(store.countRunning('u2')).toBe(1);
  });

  test('unknown job id returns undefined', () => {
    expect(store.getJob('nope')).toBeUndefined();
  });
});
