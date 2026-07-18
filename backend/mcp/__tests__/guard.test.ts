// @vitest-environment node
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { scopeForTool, registerSessionScopes, releaseSessionScopes, guard, SCOPES } from '../guard.ts';

const isDenied = (result: any) => result?.isError === true;
const message = (result: any) => String(result?.content?.[0]?.text ?? '');

// The guard writes to the real audit table; that's fine (it's additive), but
// keep each test on its own session id so scope state doesn't leak between them.
let session = 0;
const nextSession = () => `test-session-${++session}`;

describe('tool → scope mapping', () => {
  test('classifies reads, writes, and paid tools', () => {
    expect(scopeForTool('list_projects')).toBe('read');
    expect(scopeForTool('create_project')).toBe('write');
    expect(scopeForTool('update_project')).toBe('write');
    expect(scopeForTool('set_workflow')).toBe('write');
    expect(scopeForTool('generate_image')).toBe('generate');
    expect(scopeForTool('run_workflow')).toBe('generate');
  });

  test('unknown tools default to the least privilege', () => {
    expect(scopeForTool('something_new')).toBe('read');
  });
});

describe('scope enforcement', () => {
  let sessionId: string;
  const userId = 'guard-test-user';

  beforeEach(() => { sessionId = nextSession(); });
  afterEach(() => releaseSessionScopes(sessionId));

  test('a read-and-write connection cannot spend money', async () => {
    registerSessionScopes(sessionId, userId, ['read', 'write']);

    const allowed = await guard({ userId, sessionId }, 'set_workflow', {}, async () => ({ ok: true }));
    expect(allowed).toEqual({ ok: true });

    const denied: any = await guard({ userId, sessionId }, 'generate_image', {}, async () => ({ ok: true }));
    expect(isDenied(denied)).toBe(true);
    expect(message(denied)).toContain("does not have 'generate' permission");
    expect(message(denied)).toContain('Reconnect');
  });

  test('a generate-only connection cannot edit the canvas', async () => {
    registerSessionScopes(sessionId, userId, ['read', 'generate']);
    const denied: any = await guard({ userId, sessionId }, 'add_node', {}, async () => ({ ok: true }));
    expect(isDenied(denied)).toBe(true);
    expect(message(denied)).toContain("does not have 'write' permission");
  });

  test('tokens issued before scopes existed (scope=read) keep full access', async () => {
    registerSessionScopes(sessionId, userId, ['read']);
    const result = await guard({ userId, sessionId }, 'generate_image', {}, async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  test('a token with no scopes at all gets the full set', async () => {
    registerSessionScopes(sessionId, userId, undefined);
    const result = await guard({ userId, sessionId }, 'run_workflow', {}, async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  test('scopes come from the session, not the caller', async () => {
    registerSessionScopes(sessionId, userId, ['read', 'write']);
    // A different session for the same user with full scopes must not leak in.
    const other = nextSession();
    registerSessionScopes(other, userId, [...SCOPES]);
    const denied: any = await guard({ userId, sessionId }, 'generate_text', {}, async () => ({ ok: true }));
    expect(isDenied(denied)).toBe(true);
    releaseSessionScopes(other);
  });
});

describe('rate limiting', () => {
  const userId = `rate-user-${Date.now()}`;
  const sessionId = nextSession();

  beforeEach(() => registerSessionScopes(sessionId, userId, [...SCOPES]));
  afterEach(() => { releaseSessionScopes(sessionId); vi.useRealTimers(); });

  test('the 11th generation call in a minute is refused with a retry hint', async () => {
    for (let i = 0; i < 10; i++) {
      const ok = await guard({ userId, sessionId }, 'generate_text', {}, async () => ({ ok: true }));
      expect(ok, `call ${i}`).toEqual({ ok: true });
    }
    const denied: any = await guard({ userId, sessionId }, 'generate_text', {}, async () => ({ ok: true }));
    expect(isDenied(denied)).toBe(true);
    expect(message(denied)).toContain('10 generation calls/minute');
    expect(message(denied)).toMatch(/Try again in \d+s/);

    // read tools are on a separate, roomier budget
    const stillFine = await guard({ userId, sessionId }, 'list_projects', {}, async () => ({ ok: true }));
    expect(stillFine).toEqual({ ok: true });
  });
});
