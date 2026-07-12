// @vitest-environment node
import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createOAuthStore, generateOpaqueToken, sha256, type OAuthStore } from '../auth/store.ts';

const CLIENT = {
  client_id: 'client-1',
  client_name: 'Test Client',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  token_endpoint_auth_method: 'none',
} as any;

function expireRow(db: InstanceType<typeof Database>, table: string, where: string, value: string) {
  db.prepare(`UPDATE ${table} SET expires_at = '2000-01-01 00:00:00' WHERE ${where} = ?`).run(value);
}

describe('oauth store', () => {
  let db: InstanceType<typeof Database>;
  let store: OAuthStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = createOAuthStore(db as any);
    store.createClient(CLIENT);
  });

  test('round-trips a registered client through the metadata column', () => {
    const client = store.getClient('client-1');
    expect(client?.client_name).toBe('Test Client');
    expect(client?.redirect_uris).toEqual(['https://claude.ai/api/mcp/auth_callback']);
    expect(store.getClient('nope')).toBeUndefined();
  });

  test('opaque tokens carry their prefix and are unique', () => {
    const a = generateOpaqueToken('mcp_at_');
    const b = generateOpaqueToken('mcp_at_');
    expect(a).toMatch(/^mcp_at_/);
    expect(a).not.toBe(b);
  });

  test('authorization codes are single-use', () => {
    const code = generateOpaqueToken('mcp_code_');
    store.createAuthorizationCode({
      code, clientId: 'client-1', userId: 'user-1',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback', codeChallenge: 'challenge-abc',
    });

    expect(store.getAuthorizationCode(code)?.code_challenge).toBe('challenge-abc');
    const consumed = store.consumeAuthorizationCode(code);
    expect(consumed?.user_id).toBe('user-1');
    // second spend must fail
    expect(store.consumeAuthorizationCode(code)).toBeUndefined();
  });

  test('expired authorization codes cannot be consumed', () => {
    const code = generateOpaqueToken('mcp_code_');
    store.createAuthorizationCode({
      code, clientId: 'client-1', userId: 'user-1',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback', codeChallenge: 'c',
    });
    expireRow(db, 'oauth_authorization_codes', 'code_hash', sha256(code));
    expect(store.consumeAuthorizationCode(code)).toBeUndefined();
  });

  test('raw codes and tokens are never stored — only hashes', () => {
    const code = generateOpaqueToken('mcp_code_');
    store.createAuthorizationCode({
      code, clientId: 'client-1', userId: 'user-1',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback', codeChallenge: 'c',
    });
    const pair = store.issueTokenPair({ clientId: 'client-1', userId: 'user-1' });

    const codeRows = db.prepare('SELECT code_hash FROM oauth_authorization_codes').all() as any[];
    const tokenRows = db.prepare('SELECT token_hash FROM oauth_tokens').all() as any[];
    for (const row of codeRows) expect(row.code_hash).not.toContain(code);
    for (const row of tokenRows) {
      expect(row.token_hash).not.toBe(pair.accessToken);
      expect(row.token_hash).not.toBe(pair.refreshToken);
    }
  });

  test('issued access tokens verify until expired', () => {
    const pair = store.issueTokenPair({ clientId: 'client-1', userId: 'user-1', scope: 'read' });
    const found = store.findAccessToken(pair.accessToken);
    expect(found?.user_id).toBe('user-1');
    expect(found?.scope).toBe('read');
    expect(store.findAccessToken('mcp_at_bogus')).toBeUndefined();

    expireRow(db, 'oauth_tokens', 'token_hash', sha256(pair.accessToken));
    expect(store.findAccessToken(pair.accessToken)).toBeUndefined();
  });

  test('refresh rotation revokes the old pair and detects replay', () => {
    const first = store.issueTokenPair({ clientId: 'client-1', userId: 'user-1' });
    const second = store.rotateRefreshToken(first.refreshToken);
    expect(second).toBeDefined();
    expect(second!.accessToken).not.toBe(first.accessToken);

    // old pair fully dead
    expect(store.findAccessToken(first.accessToken)).toBeUndefined();
    // replaying the rotated refresh token fails
    expect(store.rotateRefreshToken(first.refreshToken)).toBeUndefined();
    // new pair works
    expect(store.findAccessToken(second!.accessToken)?.user_id).toBe('user-1');
  });

  test('revoking by either token kills the whole pair', () => {
    const pair = store.issueTokenPair({ clientId: 'client-1', userId: 'user-1' });
    store.revokeTokenPair(pair.accessToken);
    expect(store.findAccessToken(pair.accessToken)).toBeUndefined();
    expect(store.rotateRefreshToken(pair.refreshToken)).toBeUndefined();
    // idempotent + unknown token is a no-op
    store.revokeTokenPair(pair.accessToken);
    store.revokeTokenPair('mcp_at_unknown');
  });
});
