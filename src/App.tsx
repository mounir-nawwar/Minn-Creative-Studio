import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ProjectSidebar from './components/ProjectSidebar';
import Toolbar from './components/Toolbar';
import ProjectContextBar from './components/ProjectContextBar';
import Canvas from './canvas/Canvas';
import CustomLoginPage from './components/CustomLoginPage';
import ChatDrawer from './components/ChatDrawer';
import ProjectPicker from './pages/ProjectPicker';
import ProjectCreationOverlay from './components/ProjectCreationOverlay';
import { useProject } from './hooks/useProject';
import { AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, signOut as firebaseLogOut, db, getGoogleRedirectResult } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getDocFromServer, doc } from 'firebase/firestore';
import { ShieldCheck, Loader2, Key } from 'lucide-react';
import { useProjectStore } from './store/useProjectStore';
import { useStore } from './store/useStore';
import { ReactFlowProvider } from 'reactflow';
import { AUTHORIZED_EMAILS, isAuthorized, API_BASE } from './constants';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const { currentProject, isSettingsOpen, closeSettings, settingsMode } = useProjectStore();
  const { updateCurrentProject } = useProject();
  const setNodes = useStore((state) => state.setNodes);
  const setEdges = useStore((state) => state.setEdges);

  // Clear canvas when switching projects
  useEffect(() => {
    setNodes([]);
    setEdges([]);
  }, [currentProject?.id, setNodes, setEdges]);

  useEffect(() => {
    console.time("AppInit");
    console.log("Initializing App...");
    
    // 1. Check Backend Session
    const checkAuth = async () => {
      console.time("CheckAuth");
      try {
        const response = await fetch(`${API_BASE}/me`);
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
        console.timeEnd("CheckAuth");
      } catch (err) {
        console.error("CheckAuth error:", err);
        setIsAuthenticated(false);
        console.timeEnd("CheckAuth");
      }
    };
    checkAuth();

    // 2. Listen for Firebase Auth
    console.time("FirebaseAuth");
    
    // Check for redirect result on page load
    getGoogleRedirectResult().then((result) => {
      if (result?.user) {
        // User came back from Google redirect, session already set by Firebase
        setUser(result.user);
      }
    }).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Firebase Auth state changed:", u ? "User logged in" : "No user");
      setUser(u);
      setLoading(false);
      console.timeEnd("FirebaseAuth");
      console.timeEnd("AppInit");
    }, (err) => {
      console.error("Firebase Auth error:", err);
      setLoading(false);
      console.timeEnd("FirebaseAuth");
      console.timeEnd("AppInit");
    });
    
    // 3. Check AI Studio API Key
    const checkApiKey = async () => {
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } catch (err) {
          console.error("Failed to check API key", err);
          setHasApiKey(true);
        }
      } else {
        setHasApiKey(true);
      }
    };
    checkApiKey();

    // Safety timeout: if auth doesn't resolve in 5s, stop loading anyway
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Auth state check timed out after 5s");
        setLoading(false);
        setIsAuthenticated(prev => prev === null ? false : prev);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    console.log("App State:", { isAuthenticated, loading, user: !!user, hasApiKey, currentProject: !!currentProject });
  }, [isAuthenticated, loading, user, hasApiKey, currentProject]);

  // Separate connection test to not block main initialization
  useEffect(() => {
    if (!user) return;
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firebase connection test: Client appears offline.");
        }
      }
    };
    testConnection();
  }, [user]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (err) {
        console.error("Failed to open key selector", err);
      }
    }
  };

  const handleCustomLogout = async () => {
    try {
      await fetch(`${API_BASE}/logout`, { method: 'POST' });
      setIsAuthenticated(false);
      firebaseLogOut();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  if (isAuthenticated === null || (isAuthenticated && loading)) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#0097A7] border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(0,151,167,0.2)]" />
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.3em]">Initializing Minn Studio</p>
          <p className="text-[8px] text-gray-700 uppercase font-bold tracking-widest">
            {isAuthenticated === null ? "Verifying Session..." : "Connecting to Firebase..."}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <CustomLoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-6xl font-black text-white tracking-tighter">
              MINN <span className="text-[#0097A7]">STUDIO</span>
            </h1>
            <p className="text-gray-500 text-sm font-medium">The Professional AI Creative Pipeline</p>
          </div>
          
          <div className="p-8 bg-[#111111] border border-[#1a1a1a] rounded-3xl space-y-6 shadow-2xl">
            <div className="flex justify-center">
              <div className="p-4 bg-[#0097A7]/10 rounded-full">
                <ShieldCheck className="w-12 h-12 text-[#0097A7]" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Welcome Admin</h2>
              <p className="text-gray-500 text-xs">Sign in with your Google account to access your creative workflows and generated assets.</p>
            </div>
            <button
              onClick={signInWithGoogle}
              className="w-full py-4 bg-white hover:bg-gray-100 text-black font-black rounded-2xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              CONTINUE WITH GOOGLE
            </button>
            <button 
              onClick={handleCustomLogout}
              className="w-full text-[10px] text-gray-600 hover:text-red-500 font-bold uppercase tracking-widest transition-colors"
            >
              Switch Admin Account
            </button>
          </div>
          
          <p className="text-[10px] text-gray-700 uppercase font-bold tracking-widest">Powered by Gemini 3.1 & Veo 3</p>
        </div>
      </div>
    );
  }

  if (user && !isAuthorized(user.email)) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8">
          <div className="p-8 bg-[#111111] border border-[#1a1a1a] rounded-3xl space-y-6 shadow-2xl">
            <div className="flex justify-center">
              <div className="p-4 bg-red-500/10 rounded-full">
                <ShieldCheck className="w-12 h-12 text-red-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Unauthorized Account</h2>
              <p className="text-gray-500 text-xs">
                The account <span className="text-white font-bold">{user.email}</span> is not authorized to access this studio.
              </p>
            </div>
            <button
              onClick={handleCustomLogout}
              className="w-full py-4 bg-white hover:bg-gray-100 text-black font-black rounded-2xl transition-all uppercase text-[11px] tracking-widest"
            >
              Sign Out & Try Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hasApiKey === false) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-6xl font-black text-white tracking-tighter">
              MINN <span className="text-[#0097A7]">STUDIO</span>
            </h1>
            <p className="text-gray-500 text-sm font-medium">API Configuration Required</p>
          </div>
          
          <div className="p-8 bg-[#111111] border border-[#1a1a1a] rounded-3xl space-y-6 shadow-2xl">
            <div className="flex justify-center">
              <div className="p-4 bg-[#0097A7]/10 rounded-full">
                <Key className="w-12 h-12 text-[#0097A7]" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Select Your API Key</h2>
              <p className="text-gray-500 text-xs text-balance">
                High-performance models like Imagen 4 and Veo 3 require a paid API key from a Google Cloud project with billing enabled.
              </p>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] text-[#0097A7] hover:underline uppercase font-bold tracking-widest block pt-2"
              >
                Learn about billing
              </a>
            </div>
            <button
              onClick={handleSelectKey}
              className="w-full py-4 bg-[#0097A7] hover:bg-[#00838F] text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
            >
              SELECT API KEY
            </button>
          </div>
          
          <p className="text-[10px] text-gray-700 uppercase font-bold tracking-widest">Secure Configuration</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return <ProjectPicker />;
  }

  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen bg-black flex overflow-hidden font-sans selection:bg-[#0097A7]/30">
        <ProjectSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <ProjectContextBar />
          <Toolbar user={user} onLogout={handleCustomLogout} />
          <Canvas />
          <ChatDrawer />

          <AnimatePresence>
            {isSettingsOpen && (
              <ProjectCreationOverlay
                isOpen={isSettingsOpen}
                onClose={closeSettings}
                mode={settingsMode}
                existingProject={currentProject}
                onCreate={async (data) => {
                  await updateCurrentProject(data);
                  closeSettings();
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
