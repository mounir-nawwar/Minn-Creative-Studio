import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { API_BASE } from '../constants';
import MinnLogo from '../assets/Minn.svg';
import AuthLayout, { SF } from './AuthLayout';

interface CustomLoginPageProps {
  onLoginSuccess: () => void;
}

export default function CustomLoginPage({ onLoginSuccess }: CustomLoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (data.success) {
        onLoginSuccess();
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .login-field-label {
          display: block;
          font-size: clamp(10px, 0.72vw, 12px);
          font-weight: 500;
          color: rgba(255,255,255,0.36);
          letter-spacing: 0.07em;
          text-transform: uppercase;
          margin-bottom: clamp(6px, 0.5vw, 8px);
          margin-left: 1px;
          font-family: ${SF};
        }
        .login-field-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: clamp(10px, 0.85vw, 13px);
          padding: clamp(11px, 0.95vw, 14px) clamp(13px, 1.1vw, 16px);
          color: #fff;
          font-size: clamp(13px, 1vw, 15px);
          font-family: ${SF};
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          -webkit-appearance: none;
          caret-color: #0097A7;
        }
        .login-field-input::placeholder { color: rgba(255,255,255,0.2); }
        .login-field-input:focus {
          border-color: rgba(0,151,167,0.7);
          background: rgba(0,151,167,0.05);
          box-shadow: 0 0 0 3px rgba(0,151,167,0.14);
        }
        .login-field-input:-webkit-autofill,
        .login-field-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0a1a1b inset, 0 0 0 3px rgba(0,151,167,0.14);
          -webkit-text-fill-color: #fff;
          border-color: rgba(0,151,167,0.7);
          caret-color: #0097A7;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* LOGO */}
      <div className="a0" style={{ marginBottom: 'clamp(24px, 2.2vw, 36px)' }}>
        <img src={MinnLogo} alt="Minn Studio" style={{ height: 'clamp(30px, 2.6vw, 40px)', width: 'auto', display: 'block' }} />
      </div>

      {/* CARD */}
      <div className="auth-card a1">

        {/* HEADING */}
        <div className="a2" style={{ marginBottom: 'clamp(26px, 2.4vw, 38px)', textAlign: 'center' }}>
          <h1 className="auth-heading">Sign In</h1>
          <p className="auth-subtext">Use your Minn Studio credentials</p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit}>
          <div className="a3" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1vw, 16px)', marginBottom: 'clamp(10px, 0.9vw, 14px)' }}>
            <div>
              <label className="login-field-label">Username</label>
              <input
                className="login-field-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="login-field-label">Password</label>
              <input
                className="login-field-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: 'clamp(9px, 0.75vw, 12px) clamp(11px, 1vw, 14px)',
              marginBottom: 'clamp(10px, 0.9vw, 14px)',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 'clamp(10px, 0.8vw, 12px)',
              color: 'rgba(252,165,165,0.88)',
              fontSize: 'clamp(11px, 0.82vw, 13px)',
              lineHeight: 1.45,
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0, opacity: 0.75 }} />
              {error}
            </div>
          )}

          <div className="a4">
            <button type="submit" disabled={loading} className="auth-btn-white">
              {loading
                ? <Loader2 size={15} style={{ animation: 'spin 0.75s linear infinite' }} />
                : 'Sign In'
              }
            </button>
          </div>
        </form>
      </div>

      {/* FOOTER */}
      <p className="a4" style={{
        marginTop: 'clamp(20px, 1.8vw, 30px)',
        fontSize: 'clamp(9px, 0.65vw, 11px)',
        color: 'rgba(255,255,255,0.15)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 500,
      }}>
        Authorized Personnel Only
      </p>
    </AuthLayout>
  );
}
