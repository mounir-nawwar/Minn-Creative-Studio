// @vitest-environment node
import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { createOAuthStore, generateOpaqueToken, type OAuthStore } from '../auth/store.ts';
import { MinnOAuthProvider } from '../auth/provider.ts';

const CLIENT = {
  client_id: 'client-1',
  client_name: 'Claude',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  token_endpoint_auth_method: 'none',
} as any;

const OTHER_CLIENT = { ...CLIENT, client_id: 'client-2' };

const USERS: Record<string, { id: string; username: string; display_name: string }> = {
  'user-1': { id: 'user-1', username: 'mounir.nawwar', display_name: 'Mounir Nawwar' },
};

describe('MinnOAuthProvider', () => {
  let store: OAuthStore;
  let provider: MinnOAuthProvider;

  beforeEach(() => {
    store = createOAuthStore(new Database(':memory:') as any);
    provider = new MinnOAuthProvider(store, (id) => USERS[id]);
    store.createClient(CLIENT);
    store.createClient(OTHER_CLIENT);
  });

  function issueCode(challenge = 'challenge-abc'): string {
    const code = generateOpaqueToken('mcp_code_');
    store.createAuthorizationCode({
      code, clientId: 'client-1', userId: 'user-1',
      redirectUri: CLIENT.redirect_uris[0], codeChallenge: challenge, scope: 'read',
    });
    return code;
  }

  test('challengeForAuthorizationCode returns the stored PKCE challenge', async () => {
    const code = issueCode('my-challenge');
    await expect(provider.challengeForAuthorizationCode(CLIENT, code)).resolves.toBe('my-challenge');
  });

  test('challenge lookup rejects codes issued to a different client', async () => {
    const code = issueCode();
    await expect(provider.challengeForAuthorizationCode(OTHER_CLIENT, code)).rejects.toBeInstanceOf(InvalidGrantError);
  });

  test('code exchange issues a bearer pair and is single-use', async () => {
    const code = issueCode();
    const tokens = await provider.exchangeAuthorizationCode(CLIENT, code, undefined, CLIENT.redirect_uris[0]);
    expect(tokens.access_token).toMatch(/^mcp_at_/);
    expect(tokens.refresh_token).toMatch(/^mcp_rt_/);
    expect(tokens.token_type).toBe('bearer');
    expect(tokens.scope).toBe('read');

    await expect(
      provider.exchangeAuthorizationCode(CLIENT, code, undefined, CLIENT.redirect_uris[0])
    ).rejects.toBeInstanceOf(InvalidGrantError);
  });

  test('code exchange rejects a mismatched redirect_uri', async () => {
    const code = issueCode();
    await expect(
      provider.exchangeAuthorizationCode(CLIENT, code, undefined, 'https://evil.example/callback')
    ).rejects.toBeInstanceOf(InvalidGrantError);
  });

  test('verifyAccessToken returns per-user AuthInfo', async () => {
    const code = issueCode();
    const tokens = await provider.exchangeAuthorizationCode(CLIENT, code);
    const info = await provider.verifyAccessToken(tokens.access_token);
    expect(info.clientId).toBe('client-1');
    expect(info.scopes).toEqual(['read']);
    expect(info.extra).toMatchObject({ userId: 'user-1', username: 'mounir.nawwar' });
    expect(info.expiresAt).toBeGreaterThan(Date.now() / 1000);
  });

  test('verifyAccessToken rejects unknown and revoked tokens', async () => {
    await expect(provider.verifyAccessToken('mcp_at_bogus')).rejects.toBeInstanceOf(InvalidTokenError);

    const tokens = await provider.exchangeAuthorizationCode(CLIENT, issueCode());
    await provider.revokeToken(CLIENT, { token: tokens.access_token });
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  test('verifyAccessToken rejects tokens whose owner disappeared', async () => {
    const tokens = await provider.exchangeAuthorizationCode(CLIENT, issueCode());
    delete USERS['user-1'];
    try {
      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
    } finally {
      USERS['user-1'] = { id: 'user-1', username: 'mounir.nawwar', display_name: 'Mounir Nawwar' };
    }
  });

  test('refresh exchange rotates and enforces client ownership', async () => {
    const tokens = await provider.exchangeAuthorizationCode(CLIENT, issueCode());

    await expect(
      provider.exchangeRefreshToken(OTHER_CLIENT, tokens.refresh_token!)
    ).rejects.toBeInstanceOf(InvalidGrantError);

    const rotated = await provider.exchangeRefreshToken(CLIENT, tokens.refresh_token!);
    expect(rotated.access_token).not.toBe(tokens.access_token);
    // the pre-rotation access token is dead
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
