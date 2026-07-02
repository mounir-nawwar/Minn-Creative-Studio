import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import CustomLoginPage from './components/CustomLoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useProject } from './hooks/useProject';

// Heavy main-app components — only loaded after authentication
const ProjectSidebar      = lazy(() => import('./components/ProjectSidebar'));
const Toolbar             = lazy(() => import('./components/Toolbar'));
const ProjectContextBar   = lazy(() => import('./components/ProjectContextBar'));
const Canvas              = lazy(() => import('./canvas/Canvas'));
const ChatDrawer          = lazy(() => import('./components/ChatDrawer'));
const ProjectPicker       = lazy(() => import('./pages/ProjectPicker'));
const ProjectCreationOverlay = lazy(() => import('./components/ProjectCreationOverlay'));
const ChatStudio          = lazy(() => import('./components/ChatStudio/ChatStudio'));
import { motion, AnimatePresence } from 'motion/react';
import type { Easing } from 'motion/react';
import { Key } from 'lucide-react';
import { useProjectStore } from './store/useProjectStore';
import { useStore } from './store/useStore';
import { ReactFlowProvider } from 'reactflow';
import { API_BASE } from './constants';
import MinnLogo from './assets/Minn.svg';
import AuthLayout, { SF } from './components/AuthLayout';
import { UnicornScene } from 'unicornstudio-react';
import { perfMonitor } from './services/performance';
import { ConnectionProvider } from './contexts/ConnectionContext';
import AssetExpandModal from './components/AssetExpandModal';
import { ToastContainer } from './components/ToastContainer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { auth, clearTokens, User } from './lib/api';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.22, ease: 'easeInOut' as Easing },
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const { currentProject, isSettingsOpen, closeSettings, settingsMode, clearProject, studioMode } = useProjectStore();
  const { updateCurrentProject } = useProject();
  const setNodes = useStore((state) => state.setNodes);
  const setEdges = useStore((state) => state.setEdges);
  
  // Track app renders for performance monitoring
  perfMonitor.incrementRenderCount();

  useEffect(() => {
    setNodes([]);
    setEdges([]);
  }, [currentProject?.id, setNodes, setEdges]);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await auth.me();
        if (result.authenticated && result.user) {
          setUser(result.user);
          auth.setCurrentUser(result.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();

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
    }, 5000);

    return () => { clearTimeout(timer); };
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try { await window.aistudio.openSelectKey(); setHasApiKey(true); } catch {}
    }
  };

  const handleLogout = () => {
    // Update UI synchronously so the screen switches to login immediately —
    // never block the logout on the network round-trip (caused "needs refresh").
    clearTokens();
    clearProject();
    setUser(null);
    // Notify the server in the background; failure is harmless (tokens already cleared).
    void auth.logout();
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    auth.setCurrentUser(loggedInUser);
  };

  // ─── Derive which screen is active ───────────────────────────────────────
  const isLoading      = loading;
  const showLogin      = !isLoading && !user;
  const showApiKey     = !isLoading && !!user && hasApiKey === false;
  const showProjects   = !isLoading && !!user && hasApiKey !== false && !currentProject;
  const inMainApp      = !isLoading && !!user && hasApiKey !== false && !!currentProject;

  // ─── Auth background: only login screens, fades out then unmounts ─────────
  const isAuthScreen = isLoading || showLogin || showApiKey;
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

      <ToastContainer />

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
                  Connecting
                </p>
              </div>
            </AuthLayout>
          </motion.div>
        )}

        {showLogin && (
          <motion.div key="login" {...fade} style={{ position: 'relative', zIndex: 2 }}>
            <CustomLoginPage onLoginSuccess={handleLoginSuccess} />
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
              <ProjectPicker onLogout={handleLogout} />
            </Suspense>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── MAIN APP — rendered independently so AnimatePresence doesn't ── */}
      {/* unmount it during any auth transition                             */}
      {inMainApp && studioMode === 'canvas' && (
        <Suspense fallback={null}>
          <ReactFlowProvider>
            <div className="h-screen w-screen bg-transparent flex overflow-hidden font-sans selection:bg-[#0097A7]/30" style={{ position: 'relative', zIndex: 2 }}>
              <ProjectSidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <ProjectContextBar />
                <Toolbar user={user!} onLogout={handleLogout} />
                <ErrorBoundary>
                  <ConnectionProvider>
                    <Canvas />
                  </ConnectionProvider>
                </ErrorBoundary>
                <ChatDrawer />
                <AssetExpandModal />
                <OfflineIndicator />
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

      {/* ── CHAT STUDIO — full-screen conversational workspace ───────────── */}
      {inMainApp && studioMode === 'chat' && (
        <Suspense fallback={null}>
          <div className="h-screen w-screen bg-transparent overflow-hidden font-sans selection:bg-[#0097A7]/30" style={{ position: 'relative', zIndex: 2 }}>
            <ErrorBoundary>
              <ChatStudio user={user!} onLogout={handleLogout} />
            </ErrorBoundary>
            <AssetExpandModal />
            <OfflineIndicator />
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
        </Suspense>
      )}
    </>
  );
}
