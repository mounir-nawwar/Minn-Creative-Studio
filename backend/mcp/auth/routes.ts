/**
 * The login-form leg of the MCP OAuth flow.
 *
 * GET /authorize (served by the SDK router) renders the login page; the form
 * POSTs here. On valid studio credentials we issue a single-use authorization
 * code and bounce the browser back to the client's redirect_uri.
 */

import express from 'express';
import { loginLimiter } from '../../config/cors.ts';
import { login } from '../../services/auth.ts';
import { SCOPES } from '../guard.ts';
import { oauthStore, generateOpaqueToken } from './store.ts';
import { renderLoginPage } from './loginPage.ts';

const router = express.Router();

interface LoginFormBody {
  username?: string;
  password?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  state?: string;
  scope?: string;
  resource?: string;
}

router.post('/login', loginLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body as LoginFormBody;
    const { username, password, client_id, redirect_uri, code_challenge, state, scope, resource } = body;

    // Re-validate the OAuth params against the client store — hidden form
    // fields are attacker-editable and must never be trusted on their own.
    const client = client_id ? oauthStore.getClient(client_id) : undefined;
    if (!client || !redirect_uri || !client.redirect_uris?.includes(redirect_uri) || !code_challenge) {
      res.status(400).type('text').send('Invalid authorization request. Restart the connection from your Claude client.');
      return;
    }

    const rerender = (error: string, status: number) => {
      res.status(status).setHeader('Cache-Control', 'no-store');
      res.type('html').send(
        renderLoginPage({
          clientName: client.client_name || client.client_id,
          scopes: scope ? scope.split(' ') : [],
          oauthParams: { client_id, redirect_uri, code_challenge, state, scope, resource },
          error,
        })
      );
    };

    if (!username || !password) {
      rerender('Enter your username and password.', 400);
      return;
    }

    // Existing timing-safe studio login (same code path as the app's login).
    const auth = await login({ username, password });
    if (!auth) {
      rerender('Invalid username or password.', 401);
      return;
    }

    // Clients that request no scopes get the full set — Claude surfaces don't
    // let a user pick, and a read-only connector would be useless here.
    const grantedScope = scope?.trim() ? scope : SCOPES.join(' ');

    const code = generateOpaqueToken('mcp_code_');
    oauthStore.createAuthorizationCode({
      code,
      clientId: client.client_id,
      userId: auth.user.id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      scope: grantedScope,
      resource,
    });

    const redirect = new URL(redirect_uri);
    redirect.searchParams.set('code', code);
    if (state) redirect.searchParams.set('state', state);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, redirect.toString());
  } catch (error: unknown) {
    console.error('[MCP] OAuth login failed:', error);
    res.status(500).type('text').send('Something went wrong. Restart the connection from your Claude client.');
  }
});

export default router;
