/**
 * OAuth 2.1 storage for the MCP connector.
 *
 * Three tables: registered clients (DCR), single-use authorization codes, and
 * access/refresh token pairs. Raw codes and tokens are NEVER stored — only
 * SHA-256 hashes — so a database backup leaks nothing usable.
 *
 * Exposed as a factory (`createOAuthStore`) so unit tests can run against an
 * in-memory database; the app uses the shared singleton `oauthStore`.
 */

import crypto from 'crypto';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { db, generateId } from '../../services/database.ts';
import { ACCESS_TOKEN_TTL_MS, AUTH_CODE_TTL_MS, REFRESH_TOKEN_TTL_MS } from '../config.ts';

type SqliteDb = typeof db;

export type TokenPrefix = 'mcp_at_' | 'mcp_rt_' | 'mcp_code_';

export interface AuthorizationCodeRow {
  code_hash: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string | null;
  resource: string | null;
  expires_at: string;
  used_at: string | null;
}

export interface TokenRow {
  id: string;
  token_hash: string;
  token_type: 'access' | 'refresh';
  pair_id: string;
  client_id: string;
  user_id: string;
  scope: string | null;
  resource: string | null;
  expires_at: string;
  revoked_at: string | null;
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateOpaqueToken(prefix: TokenPrefix): string {
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
}

/** SQLite CURRENT_TIMESTAMP format (UTC, 'YYYY-MM-DD HH:MM:SS') so SQL comparisons work. */
function toSqliteDatetime(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').slice(0, 19);
}

export function createOAuthStore(database: SqliteDb) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_secret_hash TEXT,
      client_name TEXT,
      redirect_uris TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
      code_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      scope TEXT,
      resource TEXT,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      token_type TEXT NOT NULL CHECK(token_type IN ('access','refresh')),
      pair_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT,
      resource TEXT,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_hash ON oauth_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_pair ON oauth_tokens(pair_id);
  `);

  return {
    /**
     * The full DCR JSON (including any client_secret) round-trips through the
     * metadata column: the SDK's token-endpoint client auth compares the raw
     * secret, so hashing it would break confidential clients. claude.ai and
     * Claude Code register as public PKCE clients (no secret), so in practice
     * nothing sensitive lands here.
     */
    createClient(info: OAuthClientInformationFull): void {
      const stmt = database.prepare(`
        INSERT OR REPLACE INTO oauth_clients (client_id, client_name, redirect_uris, metadata)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(
        info.client_id,
        info.client_name ?? null,
        JSON.stringify(info.redirect_uris ?? []),
        JSON.stringify(info)
      );
    },

    getClient(clientId: string): OAuthClientInformationFull | undefined {
      const row = database.prepare('SELECT metadata FROM oauth_clients WHERE client_id = ?').get(clientId) as
        | { metadata: string }
        | undefined;
      if (!row) return undefined;
      try {
        return JSON.parse(row.metadata) as OAuthClientInformationFull;
      } catch {
        return undefined;
      }
    },

    createAuthorizationCode(args: {
      code: string;
      clientId: string;
      userId: string;
      redirectUri: string;
      codeChallenge: string;
      scope?: string;
      resource?: string;
    }): void {
      const stmt = database.prepare(`
        INSERT INTO oauth_authorization_codes
          (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        sha256(args.code),
        args.clientId,
        args.userId,
        args.redirectUri,
        args.codeChallenge,
        args.scope ?? null,
        args.resource ?? null,
        toSqliteDatetime(Date.now() + AUTH_CODE_TTL_MS)
      );
    },

    /** Read-only peek used by challengeForAuthorizationCode (does not consume). */
    getAuthorizationCode(code: string): AuthorizationCodeRow | undefined {
      const stmt = database.prepare(`
        SELECT * FROM oauth_authorization_codes
        WHERE code_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      `);
      return stmt.get(sha256(code)) as AuthorizationCodeRow | undefined;
    },

    /** Single-use consumption: the UPDATE guard makes double-spends return undefined. */
    consumeAuthorizationCode(code: string): AuthorizationCodeRow | undefined {
      const hash = sha256(code);
      const result = database
        .prepare(`
          UPDATE oauth_authorization_codes SET used_at = CURRENT_TIMESTAMP
          WHERE code_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        `)
        .run(hash);
      if (result.changes === 0) return undefined;
      return database.prepare('SELECT * FROM oauth_authorization_codes WHERE code_hash = ?').get(hash) as
        | AuthorizationCodeRow
        | undefined;
    },

    issueTokenPair(args: { clientId: string; userId: string; scope?: string; resource?: string }): IssuedTokenPair {
      const accessToken = generateOpaqueToken('mcp_at_');
      const refreshToken = generateOpaqueToken('mcp_rt_');
      const pairId = generateId();
      const insert = database.prepare(`
        INSERT INTO oauth_tokens (id, token_hash, token_type, pair_id, client_id, user_id, scope, resource, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertBoth = database.transaction(() => {
        insert.run(
          generateId(), sha256(accessToken), 'access', pairId,
          args.clientId, args.userId, args.scope ?? null, args.resource ?? null,
          toSqliteDatetime(Date.now() + ACCESS_TOKEN_TTL_MS)
        );
        insert.run(
          generateId(), sha256(refreshToken), 'refresh', pairId,
          args.clientId, args.userId, args.scope ?? null, args.resource ?? null,
          toSqliteDatetime(Date.now() + REFRESH_TOKEN_TTL_MS)
        );
      });
      insertBoth();
      return { accessToken, refreshToken, expiresInSeconds: Math.floor(ACCESS_TOKEN_TTL_MS / 1000) };
    },

    findAccessToken(rawToken: string): TokenRow | undefined {
      const stmt = database.prepare(`
        SELECT * FROM oauth_tokens
        WHERE token_hash = ? AND token_type = 'access'
          AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      `);
      return stmt.get(sha256(rawToken)) as TokenRow | undefined;
    },

    /**
     * Refresh rotation: validates the presented refresh token, revokes its whole
     * pair, and issues a fresh pair for the same client/user/scope. A replayed
     * (already-rotated) refresh token — or one owned by a different client when
     * expectedClientId is given — returns undefined.
     */
    rotateRefreshToken(rawToken: string, expectedClientId?: string): IssuedTokenPair | undefined {
      const row = database
        .prepare(`
          SELECT * FROM oauth_tokens
          WHERE token_hash = ? AND token_type = 'refresh'
            AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        `)
        .get(sha256(rawToken)) as TokenRow | undefined;
      if (!row) return undefined;
      if (expectedClientId && row.client_id !== expectedClientId) return undefined;
      database
        .prepare('UPDATE oauth_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE pair_id = ? AND revoked_at IS NULL')
        .run(row.pair_id);
      return this.issueTokenPair({
        clientId: row.client_id,
        userId: row.user_id,
        scope: row.scope ?? undefined,
        resource: row.resource ?? undefined,
      });
    },

    /** Revoke by either token of the pair. Idempotent; unknown tokens are a no-op. */
    revokeTokenPair(rawToken: string): void {
      const row = database
        .prepare('SELECT pair_id FROM oauth_tokens WHERE token_hash = ?')
        .get(sha256(rawToken)) as { pair_id: string } | undefined;
      if (!row) return;
      database
        .prepare('UPDATE oauth_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE pair_id = ? AND revoked_at IS NULL')
        .run(row.pair_id);
    },
  };
}

export type OAuthStore = ReturnType<typeof createOAuthStore>;

/** App-wide store bound to the shared SQLite database (creates tables on import). */
export const oauthStore = createOAuthStore(db);
