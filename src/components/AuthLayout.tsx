import React from 'react';

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif";
const SFDisplay = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif";

export { SF, SFDisplay };

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <style>{`
        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .a0 { opacity: 0; animation: authFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.00s forwards; }
        .a1 { opacity: 0; animation: authFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.12s forwards; }
        .a2 { opacity: 0; animation: authFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.22s forwards; }
        .a3 { opacity: 0; animation: authFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.32s forwards; }
        .a4 { opacity: 0; animation: authFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.42s forwards; }

        .auth-card {
          width: 100%;
          max-width: clamp(320px, 26vw, 400px);
          background: rgba(6,6,6,0.38);
          backdrop-filter: blur(64px) saturate(180%) brightness(0.95);
          -webkit-backdrop-filter: blur(64px) saturate(180%) brightness(0.95);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: clamp(20px, 1.8vw, 28px);
          padding: clamp(30px, 2.8vw, 42px) clamp(24px, 2.2vw, 36px) clamp(26px, 2.4vw, 38px);
          box-shadow:
            0 0 0 0.5px rgba(255,255,255,0.04) inset,
            0 32px 80px rgba(0,0,0,0.55),
            0 0 60px rgba(0,151,167,0.06);
        }

        .auth-heading {
          margin: 0;
          font-size: clamp(24px, 2vw, 32px);
          font-weight: 200;
          color: #fff;
          letter-spacing: -0.025em;
          line-height: 1.15;
          font-family: ${SFDisplay};
        }

        .auth-subtext {
          margin: clamp(7px, 0.6vw, 10px) 0 0;
          font-size: clamp(11px, 0.85vw, 13px);
          color: rgba(255,255,255,0.32);
          letter-spacing: 0.01em;
          font-weight: 400;
          font-family: ${SF};
        }

        .auth-btn-white {
          width: 100%;
          height: clamp(44px, 3.5vw, 52px);
          background: rgba(255,255,255,0.93);
          border: none;
          border-radius: clamp(10px, 0.85vw, 13px);
          color: #0a0a0a;
          font-size: clamp(13px, 1vw, 15px);
          font-weight: 500;
          font-family: ${SF};
          letter-spacing: 0.01em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(8px, 0.7vw, 10px);
          transition: background 0.18s ease, transform 0.16s ease, box-shadow 0.18s ease;
          -webkit-appearance: none;
        }
        .auth-btn-white:hover:not(:disabled) {
          background: #fff;
          transform: scale(1.01);
          box-shadow: 0 8px 28px rgba(255,255,255,0.14);
        }
        .auth-btn-white:active:not(:disabled) { transform: scale(0.99); }
        .auth-btn-white:disabled { opacity: 0.45; cursor: not-allowed; }

        .auth-btn-teal {
          width: 100%;
          height: clamp(44px, 3.5vw, 52px);
          background: #0097A7;
          border: none;
          border-radius: clamp(10px, 0.85vw, 13px);
          color: #fff;
          font-size: clamp(13px, 1vw, 15px);
          font-weight: 500;
          font-family: ${SF};
          letter-spacing: 0.01em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(8px, 0.7vw, 10px);
          transition: background 0.18s ease, transform 0.16s ease, box-shadow 0.18s ease;
          -webkit-appearance: none;
        }
        .auth-btn-teal:hover:not(:disabled) {
          background: #00afc1;
          transform: scale(1.01);
          box-shadow: 0 8px 28px rgba(0,151,167,0.3);
        }
        .auth-btn-teal:active:not(:disabled) { transform: scale(0.99); }
        .auth-btn-teal:disabled { opacity: 0.45; cursor: not-allowed; }

        .auth-link-btn {
          background: none;
          border: none;
          padding: clamp(6px, 0.5vw, 8px);
          font-size: clamp(10px, 0.72vw, 12px);
          color: rgba(255,255,255,0.28);
          font-family: ${SF};
          letter-spacing: 0.06em;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.18s ease;
          text-transform: uppercase;
          width: 100%;
          text-align: center;
        }
        .auth-link-btn:hover { color: rgba(255,255,255,0.55); }
      `}</style>

      <div style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(20px, 2vw, 40px)',
        fontFamily: SF,
      }}>
        {children}
      </div>
    </>
  );
}
