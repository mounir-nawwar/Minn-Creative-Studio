/**
 * MCP connector configuration
 * Constants and env access for the /mcp endpoint + OAuth authorization server.
 */

/**
 * Public origin used as the OAuth issuer and in token/resource metadata URLs.
 * Must be set in production (e.g. https://studio.yourdomain.com); falls back to
 * localhost for dev so the inspector/Claude Code can connect locally.
 */
export function getPublicBaseUrl(): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('[MCP] PUBLIC_BASE_URL is not set — OAuth metadata will advertise localhost. Set it in .env for production.');
  }
  return `http://localhost:${process.env.PORT || '3000'}`;
}

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h — matches app JWT access expiry
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d — matches app refresh expiry
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // OAuth 2.1 recommends short-lived codes
export const SESSION_IDLE_MS = 30 * 60 * 1000; // idle MCP sessions get swept
export const MAX_AUDIT_PARAM_BYTES = 4096; // params JSON stored in mcp_audit_log is truncated
