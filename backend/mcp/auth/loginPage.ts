/**
 * Server-rendered OAuth login/consent page for the MCP connector.
 * One self-contained HTML document — no framework, no external assets —
 * styled to match the app's design system (bg #0a0a0a, teal #0097A7).
 */

export interface LoginPageOptions {
  /** Client display name from DCR (attacker-controlled — always escaped). */
  clientName: string;
  /** Requested scopes shown on the consent line. */
  scopes: string[];
  /** OAuth params round-tripped through hidden fields to POST /mcp/auth/login. */
  oauthParams: Record<string, string | undefined>;
  /** Inline error shown after a failed attempt. */
  error?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderLoginPage({ clientName, scopes, oauthParams, error }: LoginPageOptions): string {
  const hiddenFields = Object.entries(oauthParams)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('\n        ');

  const scopeLine = scopes.length > 0
    ? `It will get <strong>${escapeHtml(scopes.join(', '))}</strong> access, acting as you.`
    : 'It will act as you.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Connect Claude — Minn Creative Studio</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a; color: #e5e7eb; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
    }
    .card {
      width: 100%; max-width: 400px; background: #141414; border-radius: 16px;
      padding: 32px; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 24px 48px rgba(0,0,0,.5);
    }
    .logo {
      width: 40px; height: 40px; border-radius: 10px; background: #0097A7;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; margin-bottom: 20px;
    }
    h1 { font-size: 17px; font-weight: 600; color: #fff; letter-spacing: -0.01em; }
    .sub { margin-top: 8px; font-size: 13px; line-height: 1.5; color: #9ca3af; }
    .sub strong { color: #d1d5db; font-weight: 500; }
    .client {
      margin: 20px 0; padding: 10px 14px; border-radius: 10px; font-size: 13px;
      background: rgba(0,151,167,.08); color: #67cfdb;
      box-shadow: inset 0 0 0 1px rgba(0,151,167,.35);
    }
    label { display: block; font-size: 12px; font-weight: 500; color: #9ca3af; margin: 14px 0 6px; }
    input[type="text"], input[type="password"] {
      width: 100%; padding: 10px 12px; border-radius: 10px; border: none; outline: none;
      background: #0a0a0a; color: #fff; font-size: 14px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
      transition: box-shadow .15s;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      box-shadow: inset 0 0 0 1px #0097A7, 0 0 0 3px rgba(0,151,167,.2);
    }
    .error {
      margin-top: 14px; padding: 10px 14px; border-radius: 10px; font-size: 13px;
      background: rgba(239,68,68,.1); color: #fca5a5;
      box-shadow: inset 0 0 0 1px rgba(239,68,68,.3);
    }
    button {
      width: 100%; margin-top: 22px; padding: 11px; border: none; border-radius: 10px;
      background: #0097A7; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background .15s, transform .1s;
    }
    button:hover { background: #00a9bb; }
    button:active { transform: scale(.98); }
    .foot { margin-top: 18px; font-size: 11px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <main class="card">
    <div class="logo">✦</div>
    <h1>Connect Claude to Minn Creative Studio</h1>
    <p class="sub">Sign in with your studio account. ${scopeLine}</p>
    <p class="client">Requested by: ${escapeHtml(clientName)}</p>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    <form method="POST" action="/mcp/auth/login" autocomplete="on">
        ${hiddenFields}
      <label for="username">Username</label>
      <input type="text" id="username" name="username" autocomplete="username" required autofocus>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
      <button type="submit">Sign in &amp; connect</button>
    </form>
    <p class="foot">Every action Claude takes is attributed to this account and audited.</p>
  </main>
</body>
</html>`;
}
