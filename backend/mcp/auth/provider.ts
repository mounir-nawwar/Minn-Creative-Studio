/**
 * OAuth 2.1 provider for the MCP connector.
 *
 * Implements the SDK's OAuthServerProvider over the SQLite store: the SDK's
 * mcpAuthRouter supplies spec-correct /authorize, /token, /register, /revoke
 * and metadata endpoints (including PKCE S256 verification); this class only
 * decides how clients/codes/tokens are stored and how the login page looks.
 */

import type { Response } from 'express';
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { users } from '../../services/database.ts';
import { oauthStore, type OAuthStore, type IssuedTokenPair } from './store.ts';
import { renderLoginPage } from './loginPage.ts';

/** 'YYYY-MM-DD HH:MM:SS' (UTC, SQLite CURRENT_TIMESTAMP format) → epoch seconds. */
function sqliteDatetimeToEpochSeconds(value: string): number {
  return Math.floor(new Date(`${value.replace(' ', 'T')}Z`).getTime() / 1000);
}

function toOAuthTokens(pair: IssuedTokenPair, scope?: string): OAuthTokens {
  return {
    access_token: pair.accessToken,
    token_type: 'bearer',
    expires_in: pair.expiresInSeconds,
    refresh_token: pair.refreshToken,
    scope,
  };
}

interface TokenOwner {
  id: string;
  username: string;
  display_name?: string;
}

type LookupUser = (userId: string) => TokenOwner | undefined;

export class MinnOAuthProvider implements OAuthServerProvider {
  private readonly store: OAuthStore;
  private readonly lookupUser: LookupUser;

  constructor(store: OAuthStore = oauthStore, lookupUser: LookupUser = (id) => users.findById(id)) {
    this.store = store;
    this.lookupUser = lookupUser;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    const store = this.store;
    return {
      getClient(clientId: string) {
        return store.getClient(clientId);
      },
      // Presence of registerClient enables Dynamic Client Registration (/register),
      // which claude.ai custom connectors require. The SDK generates client_id.
      registerClient(client: OAuthClientInformationFull) {
        store.createClient(client);
        return client;
      },
    };
  }

  /**
   * Start of the browser leg: render the login/consent page. The actual code
   * issuance happens in POST /mcp/auth/login (routes.ts) after the user's
   * studio credentials check out.
   */
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).type('html').send(
      renderLoginPage({
        clientName: client.client_name || client.client_id,
        scopes: params.scopes ?? [],
        oauthParams: {
          client_id: client.client_id,
          redirect_uri: params.redirectUri,
          code_challenge: params.codeChallenge,
          state: params.state,
          scope: params.scopes?.join(' '),
          resource: params.resource?.toString(),
        },
      })
    );
  }

  /** The SDK verifies the client's code_verifier against this stored challenge (S256). */
  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const row = this.store.getAuthorizationCode(authorizationCode);
    if (!row || row.client_id !== client.client_id) {
      throw new InvalidGrantError('Authorization code is invalid or expired');
    }
    return row.code_challenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    const row = this.store.consumeAuthorizationCode(authorizationCode);
    if (!row || row.client_id !== client.client_id) {
      throw new InvalidGrantError('Authorization code is invalid, expired, or already used');
    }
    if (redirectUri && redirectUri !== row.redirect_uri) {
      throw new InvalidGrantError('redirect_uri does not match the authorization request');
    }
    const pair = this.store.issueTokenPair({
      clientId: row.client_id,
      userId: row.user_id,
      scope: row.scope ?? undefined,
      resource: row.resource ?? undefined,
    });
    return toOAuthTokens(pair, row.scope ?? undefined);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    _scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    const pair = this.store.rotateRefreshToken(refreshToken, client.client_id);
    if (!pair) {
      throw new InvalidGrantError('Refresh token is invalid, expired, or already rotated');
    }
    return toOAuthTokens(pair);
  }

  /** Called by requireBearerAuth on every /mcp request. */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const row = this.store.findAccessToken(token);
    if (!row) {
      throw new InvalidTokenError('Access token is invalid, expired, or revoked');
    }
    const user = this.lookupUser(row.user_id);
    if (!user) {
      throw new InvalidTokenError('Token owner no longer exists');
    }
    return {
      token,
      clientId: row.client_id,
      scopes: row.scope ? row.scope.split(' ') : [],
      expiresAt: sqliteDatetimeToEpochSeconds(row.expires_at),
      extra: {
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    };
  }

  /** /revoke — by either token of the pair; idempotent. */
  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    this.store.revokeTokenPair(request.token);
  }
}
