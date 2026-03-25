import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  MessageSquare, 
  Image as ImageIcon, 
  Plus, 
  History, 
  Search, 
  Filter, 
  Trash2, 
  MoreVertical,
  ChevronRight,
  Sparkles,
  Clock,
  Box,
  Heart,
  Type,
  Zap,
  Video,
  Eye,
  FileDown,
  Pencil,
  Maximize,
  Sun,
  Clapperboard,
  Move,
  Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProjectStore } from '../store/useProjectStore';
import { useStore } from '../store/useStore';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp
} from '../firebase';
import AssetGrid from './AssetGrid';
import AssetPreviewModal from './AssetPreviewModal';
import { Asset } from '../types/project.types';

type Tab = 'nodes' | 'workflows' | 'chats' | 'assets';

export default function ProjectSidebar() {
  const { currentProject, setActiveWorkflowId, activeWorkflowId: currentWfId } = useProjectStore();
  const { setChatOpen, setActiveChatId, activeChatId, setNodes, setEdges, setPendingNodeType } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('nodes');
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const nodeCategories = [
    {
      label: 'Text / Prompt',
      nodes: [
        { type: 'prompt', label: 'Prompt Node', icon: Type, color: 'text-blue-400' },
        { type: 'directorPrompt', label: "Director's Prompt", icon: Clapperboard, color: 'text-purple-400' },
        { type: 'cameraControl', label: 'Camera Control', icon: Move, color: 'text-blue-400' },
        { type: 'promptConcatenator', label: 'Concatenator', icon: Plus, color: 'text-blue-500' },
        { type: 'promptEnhancer', label: 'Enhancer', icon: Zap, color: 'text-blue-300' },
        { type: 'llm', label: 'Run Any LLM', icon: Zap, color: 'text-indigo-400' },
        { type: 'vision', label: 'Image Describer', icon: Eye, color: 'text-indigo-300' },
        { type: 'videoDescriber', label: 'Video Describer', icon: Video, color: 'text-indigo-500' },
      ]
    },
    {
      label: 'Generation',
      nodes: [
        { type: 'imageUpload', label: 'Image Upload', icon: ImageIcon, color: 'text-blue-400' },
        { type: 'videoUpload', label: 'Video Upload', icon: Video, color: 'text-blue-500' },
        { type: 'imagen', label: 'Image Generator', icon: ImageIcon, color: 'text-purple-400' },
        { type: 'veo', label: 'Veo Video', icon: Video, color: 'text-red-400' },
        { type: 'imageToVideo', label: 'Image to Video', icon: Video, color: 'text-orange-400' },
        { type: 'lyria', label: 'Lyria Audio', icon: Zap, color: 'text-pink-400' },
      ]
    },
    {
      label: 'Editing Tools',
      nodes: [
        { type: 'levels', label: 'Levels', icon: ImageIcon, color: 'text-green-400' },
        { type: 'compositor', label: 'Compositor', icon: ImageIcon, color: 'text-green-600' },
        { type: 'painter', icon: Pencil, label: 'Painter', color: 'text-green-200' },
        { type: 'crop', label: 'Crop', icon: ImageIcon, color: 'text-green-500' },
        { type: 'resize', label: 'Resize', icon: ImageIcon, color: 'text-green-300' },
        { type: 'blur', label: 'Blur', icon: ImageIcon, color: 'text-emerald-400' },
        { type: 'invert', label: 'Invert', icon: ImageIcon, color: 'text-emerald-500' },
        { type: 'channels', label: 'Channels', icon: ImageIcon, color: 'text-emerald-300' },
      ]
    },
    {
      label: 'Enhancement',
      nodes: [
        { type: 'imageUpscaler', label: 'Image Upscaler', icon: Maximize, color: 'text-orange-400' },
        { type: 'videoUpscaler', label: 'Video Upscaler', icon: Video, color: 'text-orange-500' },
        { type: 'frameInterpolator', label: 'Frame Interpolator', icon: Zap, color: 'text-orange-300' },
        { type: 'relight', label: 'Relight AI', icon: Sun, color: 'text-yellow-500' },
      ]
    },
    {
      label: 'Matte / Masking',
      nodes: [
        { type: 'maskExtractor', label: 'Mask Extractor', icon: ImageIcon, color: 'text-cyan-400' },
        { type: 'maskByText', label: 'Mask By Text', icon: Type, color: 'text-cyan-500' },
        { type: 'videoMatte', label: 'Video Matte', icon: Video, color: 'text-cyan-600' },
        { type: 'videoMaskByText', label: 'Video Mask By Text', icon: Type, color: 'text-cyan-200' },
        { type: 'matteAdjust', label: 'Matte Adjust', icon: ImageIcon, color: 'text-cyan-300' },
        { type: 'mergeAlpha', label: 'Merge Alpha', icon: ImageIcon, color: 'text-cyan-600' },
      ]
    },
    {
      label: 'Iterators',
      nodes: [
        { type: 'textIterator', label: 'Text Iterator', icon: Plus, color: 'text-orange-500' },
        { type: 'imageIterator', label: 'Image Iterator', icon: ImageIcon, color: 'text-orange-400' },
        { type: 'videoIterator', label: 'Video Iterator', icon: Video, color: 'text-orange-600' },
      ]
    },
    {
      label: 'Data / Control',
      nodes: [
        { type: 'number', label: 'Number', icon: Plus, color: 'text-blue-400' },
        { type: 'text', label: 'Text', icon: Type, color: 'text-blue-400' },
        { type: 'toggle', label: 'Toggle', icon: Zap, color: 'text-blue-400' },
        { type: 'listSelector', label: 'List Selector', icon: FileDown, color: 'text-blue-400' },
        { type: 'seed', label: 'Seed', icon: Zap, color: 'text-blue-500' },
        { type: 'array', label: 'Array', icon: FileDown, color: 'text-blue-500' },
        { type: 'guidanceStrength', label: 'Guidance', icon: Plus, color: 'text-blue-300' },
        { type: 'motionIntensity', label: 'Motion', icon: Video, color: 'text-blue-300' },
        { type: 'cfgScale', label: 'CFG Scale', icon: Plus, color: 'text-blue-200' },
      ]
    },
    {
      label: 'Helpers',
      nodes: [
        { type: 'stickyNote', label: 'Sticky Note', icon: Type, color: 'text-yellow-200' },
        { type: 'compare', label: 'Compare', icon: Eye, color: 'text-blue-200' },
        { type: 'sequence', label: 'Video Sequence', icon: Film, color: 'text-pink-500' },
        { type: 'output', label: 'Output Collector', icon: FileDown, color: 'text-[#0097A7]' },
      ]
    }
  ];

  // KEY FIX: only set pending type, never add node directly
  const handleAddNode = (type: string, label: string) => {
    setPendingNodeType(type, { label, type: type as any, config: {} });
  };

  // Fetch Workflows
  useEffect(() => {
    if (!currentProject || !auth.currentUser) return;
    const q = query(
      collection(db, 'workflows'),
      where('userId', '==', auth.currentUser.uid),
      where('projectId', '==', currentProject.id),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setWorkflows(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [currentProject]);

  // Fetch Chats
  useEffect(() => {
    if (!currentProject || !auth.currentUser) return;
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', auth.currentUser.uid),
      where('projectId', '==', currentProject.id),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [currentProject]);

  const createNewWorkflow = async () => {
    if (!currentProject || !auth.currentUser) return;
    await addDoc(collection(db, 'workflows'), {
      name: `Workflow ${new Date().toLocaleTimeString()}`,
      projectId: currentProject.id,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      nodes: [],
      edges: []
    });
  };

  const createNewChat = async () => {
    if (!currentProject || !auth.currentUser) return;
    const docRef = await addDoc(collection(db, 'chats'), {
      title: 'New Creative Session',
      projectId: currentProject.id,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
    setActiveChatId(docRef.id);
    setChatOpen(true);
  };

  const deleteItem = async (e: React.MouseEvent, collectionName: string, id: string) => {
    e.stopPropagation();
    if (window.confirm(`Delete this ${collectionName.slice(0, -1)}?`)) {
      try {
        await deleteDoc(doc(db, collectionName, id));
        if (collectionName === 'workflows' && currentWfId === id) {
          setActiveWorkflowId(null);
          setNodes([]);
          setEdges([]);
        }
      } catch (err) {
        console.error(`Error deleting ${collectionName}:`, err);
      }
    }
  };

  if (!currentProject) return null;

  return (
    <div className="w-80 h-full bg-[#0a0a0a] border-r border-white/5 flex flex-col relative z-50">
      {/* Tabs Header */}
      <div className="flex p-2 bg-[#111111] border-b border-white/5">
        {(['nodes', 'workflows', 'chats', 'assets'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${
              activeTab === tab 
              ? 'bg-black text-[#0097A7] shadow-xl border border-white/5' 
              : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {tab === 'nodes' && <Box className="w-4 h-4" />}
            {tab === 'workflows' && <Layout className="w-4 h-4" />}
            {tab === 'chats' && <MessageSquare className="w-4 h-4" />}
            {tab === 'assets' && <ImageIcon className="w-4 h-4" />}
            <span className="text-[8px] font-black uppercase tracking-widest">{tab}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'nodes' && (
            <motion.div
              key="nodes"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar"
            >
              {nodeCategories.map((category) => (
                <div key={category.label} className="space-y-2">
                  <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-3">{category.label}</p>
                  <div className="space-y-2">
                    {category.nodes.map((item) => (
                      <button
                        key={item.type}
                        onClick={() => handleAddNode(item.type, item.label)}
                        className="w-full flex items-center gap-3 p-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] rounded-xl transition-all group"
                      >
                        <div className={`p-1.5 bg-black rounded-lg ${item.color} group-hover:scale-110 transition-transform`}>
                          <item.icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-[11px] font-bold text-gray-300">{item.label}</p>
                        </div>
                        <Plus className="w-3 h-3 text-gray-700 group-hover:text-[#0097A7] transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'workflows' && (
            <motion.div
              key="workflows"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="p-4">
                <button 
                  onClick={createNewWorkflow}
                  className="w-full py-4 bg-[#0097A7]/10 hover:bg-[#0097A7]/20 text-[#0097A7] rounded-2xl flex items-center justify-center gap-3 transition-all border border-[#0097A7]/20 group"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">New Workflow</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
                {workflows.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
                      <Layout className="w-6 h-6 text-gray-700" />
                    </div>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">No workflows yet</p>
                  </div>
                ) : (
                  workflows.map(wf => (
                    <div 
                      key={wf.id}
                      onClick={() => {
                        setNodes(wf.nodes);
                        setEdges(wf.edges);
                        setActiveWorkflowId(wf.id);
                      }}
                      className={`group relative bg-[#111111] border border-white/5 hover:border-[#0097A7]/30 rounded-2xl p-4 cursor-pointer transition-all ${currentWfId === wf.id ? 'border-[#0097A7]/50 bg-[#0097A7]/5' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black rounded-xl border border-white/5 flex items-center justify-center overflow-hidden">
                          {wf.thumbnailUrl ? (
                            <img src={wf.thumbnailUrl} className="w-full h-full object-cover" />
                          ) : (
                            <Layout className="w-5 h-5 text-gray-800" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[11px] font-black text-white uppercase truncate group-hover:text-[#0097A7] transition-colors">{wf.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-gray-600" />
                            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">
                              {wf.createdAt instanceof Timestamp ? new Date(wf.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => deleteItem(e, 'workflows', wf.id)}
                        className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'chats' && (
            <motion.div
              key="chats"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="p-4">
                <button 
                  onClick={createNewChat}
                  className="w-full py-4 bg-[#0097A7]/10 hover:bg-[#0097A7]/20 text-[#0097A7] rounded-2xl flex items-center justify-center gap-3 transition-all border border-[#0097A7]/20 group"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">New Chat</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
                {chats.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
                      <MessageSquare className="w-6 h-6 text-gray-700" />
                    </div>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">No chats yet</p>
                  </div>
                ) : (
                  chats.map(chat => (
                    <div 
                      key={chat.id}
                      onClick={() => {
                        setActiveChatId(chat.id);
                        setChatOpen(true);
                      }}
                      className={`group relative bg-[#111111] border border-white/5 hover:border-[#0097A7]/30 rounded-2xl p-4 cursor-pointer transition-all ${activeChatId === chat.id ? 'border-[#0097A7]/50 bg-[#0097A7]/5' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-black rounded-xl border border-white/5 flex items-center justify-center">
                          <History className="w-5 h-5 text-gray-800" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[11px] font-black text-white uppercase truncate group-hover:text-[#0097A7] transition-colors">{chat.title}</h4>
                          <p className="text-[9px] text-gray-600 truncate mt-0.5">{chat.lastMessage || 'No messages yet'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => deleteItem(e, 'chats', chat.id)}
                        className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'assets' && (
            <motion.div
              key="assets"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <AssetGrid onAssetClick={setSelectedAsset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedAsset && (
          <AssetPreviewModal 
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
            onDelete={() => {}}
            onToggleFavorite={() => {}}
          />
        )}
      </AnimatePresence>

      <div className="p-4 border-t border-white/5 bg-[#0d0d0d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0097A7]" />
          <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">Project Active</span>
        </div>
        <span className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">v1.0.4</span>
      </div>
    </div>
  );
}
