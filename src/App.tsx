import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import CustomLoginPage from './components/CustomLoginPage';
import { useProject } from './hooks/useProject';

// Heavy main-app components — only loaded after authentication
const ProjectSidebar      = lazy(() => import('./components/ProjectSidebar'));
const Toolbar             = lazy(() => import('./components/Toolbar'));
const ProjectContextBar   = lazy(() => import('./components/ProjectContextBar'));
const Canvas              = lazy(() => import('./canvas/Canvas'));
const ChatDrawer          = lazy(() => import('./components/ChatDrawer'));
const ProjectPicker       = lazy(() => import('./pages/ProjectPicker'));
const ProjectCreationOverlay = lazy(() => import('./components/ProjectCreationOverlay'));
import { motion, AnimatePresence } from 'motion/react';
import type { Easing } from 'motion/react';
import { auth, signInWithGoogle, signOut as firebaseLogOut, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getDocFromServer, doc } from 'firebase/firestore';
import { Key } from 'lucide-react';
import { useProjectStore } from './store/useProjectStore';
import { useStore } from './store/useStore';
import { ReactFlowProvider } from 'reactflow';
import { isAuthorized, API_BASE } from './constants';
import MinnLogo from './assets/Minn.svg';
import AuthLayout, { SF } from './components/AuthLayout';
import { UnicornScene } from 'unicornstudio-react';
import { perfMonitor } from './services/performance';
import { ConnectionProvider } from './contexts/ConnectionContext';
import AssetExpandModal from './components/AssetExpandModal';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const GOOGLE_SVG = (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
  </svg>
);

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.22, ease: 'easeInOut' as Easing },
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const { currentProject, isSettingsOpen, closeSettings, settingsMode } = useProjectStore();
  const { updateCurrentProject } = useProject();
  const setNodes = useStore((state) => state.setNodes);
  const setEdges = useStore((state) => state.setEdges);
  
  // Track app renders for performance monitoring
  perfMonitor.incrementRenderCount();

  useEffect(() => {
    setNodes([]);
    setEdges([]);
  }, [currentProject?.id, setNodes, setEdges]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE}/me`);
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    }, () => setLoading(false));

    const checkApiKey = async () => {
      if (window.aistudio) {
        try {
          setHasApiKey(await window.aistudio.hasSelectedApiKey());
        } catch {
          setHasApiKey(true);
        }
      } else {
        setHasApiKey(true);
      }
    };
    checkApiKey();

    const timer = setTimeout(() => {
      setLoading(false);
      setIsAuthenticated(prev => prev === null ? false : prev);
    }, 5000);

    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!user) return;
    getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});
  }, [user]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try { await window.aistudio.openSelectKey(); setHasApiKey(true); } catch {}
    }
  };

  const handleCustomLogout = async () => {
    try {
      await fetch(`${API_BASE}/logout`, { method: 'POST' });
      setIsAuthenticated(false);
      firebaseLogOut();
    } catch {}
  };

  // ─── Derive which screen is active ───────────────────────────────────────
  const isLoading      = isAuthenticated === null || (isAuthenticated && loading);
  const showAdminLogin = !isLoading && isAuthenticated === false;
  const showGoogle     = !isLoading && isAuthenticated === true && !user;
  const showUnauth     = !isLoading && !!user && !isAuthorized(user.email);
  const showApiKey     = !isLoading && !!user && isAuthorized(user.email) && hasApiKey === false;
  const showProjects   = !isLoading && !!user && isAuthorized(user.email) && hasApiKey !== false && !currentProject;
  const inMainApp      = !isLoading && !!user && isAuthorized(user.email) && hasApiKey !== false && !!currentProject;

  // ─── Auth background: only login screens, fades out then unmounts ─────────
  const isAuthScreen = isLoading || showAdminLogin || showGoogle || showUnauth || showApiKey;
  const [bgMounted, setBgMounted] = useState(true);
  const [bgOpacity, setBgOpacity] = useState(1);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    if (isAuthScreen) {
      setBgMounted(true);
      // Tick after mount so CSS transition fires
      fadeTimer.current = setTimeout(() => setBgOpacity(1), 20);
    } else {
      setBgOpacity(0);
      // Unmount after fade completes
      fadeTimer.current = setTimeout(() => setBgMounted(false), 700);
    }
    return () => { if (fadeTimer.current) clearTimeout(fadeTimer.current); };
  }, [isAuthScreen]);

  return (
    <>
      <style>{`
        #us-app-bg > div, #us-app-bg canvas { width:100%!important; height:100%!important; }
        @keyframes appSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── BACKGROUND — auth screens only, fades out then unmounts ────────── */}
      {bgMounted && (
        <>
          <div id="us-app-bg" style={{
            position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
            opacity: bgOpacity, transition: 'opacity 0.65s ease',
          }}>
            <UnicornScene jsonFilePath="/scene.json" />
          </div>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 70%, rgba(0,0,0,0) 100%)',
            opacity: bgOpacity, transition: 'opacity 0.65s ease',
          }} />
        </>
      )}

      {/* ── AUTH SCREENS — swap with cross-fade ─────────────────────────── */}
      <AnimatePresence mode="wait">

        {isLoading && (
          <motion.div key="loading" {...fade} style={{ position: 'relative', zIndex: 2 }}>
            <AuthLayout>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: 'clamp(32px, 2.6vw, 40px)', height: 'clamp(32px, 2.6vw, 40px)',
                  border: '1.5px solid rgba(0,151,167,0.18)',
                  borderTopColor: '#0097A7',
                  borderRadius: '50%',
                  animation: 'appSpin 0.9s linear infinite',
                }} />
                <p style={{ margin: 0, fontSize: 'clamp(9px, 0.65vw, 11px)', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, fontFamily: SF }}>
                  {isAuthenticated === null ? 'Verifying session' : 'Connecting'}
                </p>
              </div>
            </AuthLayout>
          </motion.div>
        )}

        {showAdminLogin && (
          <motion.div key="admin-login" {...fade} style={{ position: 'relative', zIndex: 2 }}>
            <CustomLoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
          </motion.div>
        )}

        {showGoogle && (
          <motion.div key="google" {...fade} style={{ position: 'relative', zIndex: 2 }}>
            <AuthLayout>
              <div className="a0" style={{ marginBottom: 'clamp(24px, 2.2vw, 36px)' }}>
                <img src={MinnLogo} alt="Minn Studio" style={{ height: 'clamp(30px, 2.6vw, 40px)', width: 'auto', display: 'block' }} />
              </div>
              <div className="auth-card a1">
                <div className="a2" style={{ marginBottom: 'clamp(26px, 2.4vw, 38px)', textAlign: 'center' }}>
                  <h1 className="auth-heading">Welcome back</h1>
                  <p className="auth-subtext">Sign in to access your creative workspace</p>
                </div>
                <div className="a3" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 0.9vw, 13px)' }}>
                  <button onClick={signInWithGoogle} className="auth-btn-white">{GOOGLE_SVG} Continue with Google</button>
                  <button onClick={handleCustomLogout} className="auth-link-btn">Switch admin account</button>
                </div>
              </div>
              <p className="a4" style={{ marginTop: 'clamp(20px, 1.8vw, 30px)', fontSize: 'clamp(9px, 0.65vw, 11px)', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, fontFamily: SF }}>
                Authorized Personnel Only
              </p>
            </AuthLayout>
          </motion.div>
        )}

        {showUnauth && (
          <motion.div key="unauthorized" {...fade} style={{ position: 'relative', zIndex: 2 }}>
            <AuthLayout>
              <div className="a0" style={{ marginBottom: 'clamp(24px, 2.2vw, 36px)' }}>
                <img src={MinnLogo} alt="Minn Studio" style={{ height: 'clamp(30px, 2.6vw, 40px)', width: 'auto', display: 'block' }} />
              </div>
              <div className="auth-card a1">
                <div className="a2" style={{ marginBottom: 'clamp(26px, 2.4vw, 38px)', textAlign: 'center' }}>
                  <h1 className="auth-heading" style={{ fontSize: 'clamp(20px, 1.7vw, 26px)' }}>Access Denied</h1>
                  <p className="auth-subtext" style={{ marginTop: 'clamp(10px, 0.9vw, 14px)', lineHeight: 1.6 }}>
                    <span style={{ color: 'rgba(255,255,255,0.55)' }}>{user!.email}</span><br />
                    is not authorized to access this studio.
                  </p>
                </div>
                <div className="a3">
                  <button onClick={handleCustomLogout} className="auth-btn-white">Sign out &amp; try another</button>
                </div>
              </div>
            </AuthLayout>
          </motion.div>
        )}

        {showApiKey && (
          <motion.div key="apikey" {...fade} style={{ position: 'relative', zIndex: 2 }}>
            <AuthLayout>
              <div className="a0" style={{ marginBottom: 'clamp(24px, 2.2vw, 36px)' }}>
                <img src={MinnLogo} alt="Minn Studio" style={{ height: 'clamp(30px, 2.6vw, 40px)', width: 'auto', display: 'block' }} />
              </div>
              <div className="auth-card a1">
                <div className="a2" style={{ marginBottom: 'clamp(26px, 2.4vw, 38px)', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'clamp(40px,3.2vw,48px)', height: 'clamp(40px,3.2vw,48px)', background: 'rgba(0,151,167,0.1)', borderRadius: '50%', marginBottom: 'clamp(14px,1.2vw,20px)' }}>
                    <Key size={20} color="#0097A7" />
                  </div>
                  <h1 className="auth-heading" style={{ fontSize: 'clamp(20px, 1.7vw, 26px)' }}>API Key Required</h1>
                  <p className="auth-subtext" style={{ marginTop: 'clamp(10px, 0.9vw, 14px)', lineHeight: 1.6 }}>
                    Imagen 4 and Veo 3 require a paid API key from a Google Cloud project with billing enabled.
                  </p>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-block', marginTop: 'clamp(10px,0.9vw,14px)', fontSize: 'clamp(10px,0.72vw,12px)', color: '#0097A7', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500, textDecoration: 'none', fontFamily: SF }}>
                    Learn about billing
                  </a>
                </div>
                <div className="a3">
                  <button onClick={handleSelectKey} className="auth-btn-teal">Select API Key</button>
                </div>
              </div>
            </AuthLayout>
          </motion.div>
        )}

        {showProjects && (
          <motion.div key="projects" {...fade} style={{ position: 'relative', zIndex: 2 }}>
            <Suspense fallback={null}>
              <ProjectPicker />
            </Suspense>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── MAIN APP — rendered independently so AnimatePresence doesn't ── */}
      {/* unmount it during any auth transition                             */}
      {inMainApp && (
        <Suspense fallback={null}>
          <ReactFlowProvider>
            <div className="h-screen w-screen bg-transparent flex overflow-hidden font-sans selection:bg-[#0097A7]/30" style={{ position: 'relative', zIndex: 2 }}>
              <ProjectSidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <ProjectContextBar />
                <Toolbar user={user!} onLogout={handleCustomLogout} />
                <ConnectionProvider>
                  <Canvas />
                </ConnectionProvider>
                <ChatDrawer />
                <AssetExpandModal />
                <AnimatePresence>
                  {isSettingsOpen && (
                    <ProjectCreationOverlay
                      isOpen={isSettingsOpen}
                      onClose={closeSettings}
                      mode={settingsMode}
                      existingProject={currentProject}
                      onCreate={async (data) => { await updateCurrentProject(data); closeSettings(); }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </ReactFlowProvider>
        </Suspense>
      )}
    </>
  );
}
