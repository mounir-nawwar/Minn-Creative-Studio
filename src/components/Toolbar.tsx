import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Save, 
  FolderOpen, 
  Trash2, 
  X, 
  Clock, 
  Loader2, 
  ChevronDown,
  Zap,
  Settings,
  Share2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  Timestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

const Toolbar = () => {
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const setNodes = useStore((state) => state.setNodes);
  const setEdges = useStore((state) => state.setEdges);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject, activeWorkflowId, setActiveWorkflowId } = useProjectStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch Workflows
  useEffect(() => {
    if (!currentProject || !auth.currentUser) return;
    const q = query(
      collection(db, 'workflows'),
      where('projectId', '==', currentProject.id),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setWorkflows(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [currentProject]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [nodes, edges]);

  // Auto-save every 2 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      if (hasUnsavedChanges && activeWorkflowId) {
        confirmSave(true);
      }
    }, 120000); // 2 minutes
    return () => clearInterval(timer);
  }, [hasUnsavedChanges, activeWorkflowId, nodes, edges]);

  // Keyboard shortcut Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeWorkflowId) {
          confirmSave();
        } else {
          setShowSaveModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWorkflowId, nodes, edges]);

  const handleSave = () => {
    if (!auth.currentUser || !currentProject) return;
    if (activeWorkflowId) {
      const currentWf = workflows.find(w => w.id === activeWorkflowId);
      setWorkflowName(currentWf?.name || '');
      confirmSave();
    } else {
      setWorkflowName(`Workflow ${new Date().toLocaleDateString()}`);
      setShowSaveModal(true);
    }
  };

  const confirmSave = async (isAuto = false) => {
    if (!currentProject || !auth.currentUser) return;
    
    setIsSaving(true);
    try {
      const workflowData = {
        nodes,
        edges,
        updatedAt: serverTimestamp(),
      };

      if (activeWorkflowId) {
        await updateDoc(doc(db, 'workflows', activeWorkflowId), workflowData);
      } else {
        const newDoc = await addDoc(collection(db, 'workflows'), {
          ...workflowData,
          name: workflowName || `Workflow ${new Date().toLocaleDateString()}`,
          projectId: currentProject.id,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });
        setActiveWorkflowId(newDoc.id);
      }
      
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setShowSaveModal(false);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteWorkflow = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeWorkflowId === id) setActiveWorkflowId(null);
    await deleteDoc(doc(db, 'workflows', id));
  };

  const loadWorkflow = (workflow: any) => {
    setNodes(workflow.nodes || []);
    setEdges(workflow.edges || []);
    setActiveWorkflowId(workflow.id);
    setWorkflowName(workflow.name);
    setHasUnsavedChanges(false);
  };

  const handleRunAll = () => {
    const nodesToRun = nodes.filter(n => 
      ['prompt', 'vision', 'imagen', 'nanoBanana', 'veo', 'imageToVideo', 'lyria'].includes(n.data.type)
    );
    
    for (const node of nodesToRun) {
      updateNodeData(node.id, { triggerRun: Date.now() });
    }
  };

  return (
    <div className="h-16 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0097A7] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,151,167,0.4)]">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xs font-black text-white uppercase tracking-widest">
              {activeWorkflowId ? workflows.find(w => w.id === activeWorkflowId)?.name : 'Untitled Workflow'}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">
                {currentProject?.name}
              </span>
              {lastSaved && (
                <span className="text-[8px] text-[#0097A7] font-bold uppercase tracking-tighter flex items-center gap-1">
                  <Clock className="w-2 h-2" />
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-white/5" />

        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1a1a1a] rounded-xl text-[10px] font-black text-gray-400 hover:text-white hover:border-[#0097A7]/50 transition-all">
              Workflows
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute top-full left-0 mt-2 w-64 bg-[#111111] border border-[#1a1a1a] rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
              <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                {workflows.map(w => (
                  <div 
                    key={w.id}
                    onClick={() => loadWorkflow(w)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${activeWorkflowId === w.id ? 'bg-[#0097A7]/20 text-[#0097A7]' : 'hover:bg-white/5 text-gray-500 hover:text-gray-300'}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Save className="w-3 h-3 flex-shrink-0" />
                      <span className="text-[10px] font-bold truncate">{w.name}</span>
                    </div>
                    <button 
                      onClick={(e) => deleteWorkflow(e, w.id)}
                      className="p-1 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {workflows.length === 0 && (
                  <p className="text-[9px] text-gray-600 text-center py-4 uppercase font-bold tracking-widest">No saved workflows</p>
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${hasUnsavedChanges ? 'bg-[#0097A7] text-white shadow-[0_0_15px_rgba(0,151,167,0.3)]' : 'bg-[#111111] border border-[#1a1a1a] text-gray-500'}`}
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {activeWorkflowId ? 'Save' : 'Save Workflow'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-[#111111] border border-[#1a1a1a] rounded-xl text-[10px] font-black text-gray-400 hover:text-white hover:border-[#0097A7]/50 transition-all uppercase tracking-widest">
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#111111] border border-[#1a1a1a] rounded-xl text-[10px] font-black text-gray-400 hover:text-white hover:border-[#0097A7]/50 transition-all uppercase tracking-widest">
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
        <button 
          onClick={handleRunAll}
          className="flex items-center gap-2 px-6 py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(0,151,167,0.3)] hover:scale-105"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Run Project
        </button>
      </div>

      {/* Save Workflow Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSaveModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <Save className="w-5 h-5 text-[#0097A7]" />
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Save Workflow</h3>
                </div>
                <button 
                  onClick={() => setShowSaveModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Workflow Name</label>
                  <input 
                    type="text"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="Enter workflow name..."
                    className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#0097A7] transition-all"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => confirmSave()}
                    disabled={!workflowName.trim() || isSaving}
                    className="flex-1 py-3 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,151,167,0.2)] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Workflow'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Toolbar;
