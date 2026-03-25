import React, { useEffect, useState } from 'react';
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
import { auth, signInWithGoogle, signOut as firebaseLogOut, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getDocFromServer, doc } from 'firebase/firestore';
import { ShieldCheck } from 'lucide-react';
import { useProjectStore } from './store/useProjectStore';
import { useStore } from './store/useStore';
import { ReactFlowProvider } from 'reactflow';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { currentProject, isSettingsOpen, closeSettings, settingsMode } = useProjectStore();
  const { updateCurrentProject } = useProject();
  const setNodes = useStore((state) => state.setNodes);
  const setEdges = useStore((state) => state.setEdges);

  useEffect(() => {
    setNodes([]);
    setEdges([]);
  }, [currentProject?.id, setNodes, setEdges]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me');
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
      } catch (err) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCustomLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
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
        <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.3em]">Initializing Minn Studio</p>
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
