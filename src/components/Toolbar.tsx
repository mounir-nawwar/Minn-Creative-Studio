import React, { useState } from 'react';
import { Play, Save, FolderOpen, Trash2, LogOut, User as UserIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { db, auth, signOut as logOut } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

const Toolbar = () => {
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const setNodes = useStore((state) => state.setNodes);
  const setEdges = useStore((state) => state.setEdges);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);

  const handleSave = async () => {
    if (!auth.currentUser || !currentProject) {
      alert("Please sign in and select a project to save workflows");
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'workflows'), {
        name: `Workflow ${new Date().toLocaleString()}`,
        nodes,
        edges,
        userId: auth.currentUser.uid,
        projectId: currentProject.id,
        createdAt: Timestamp.now(),
      });

      // Update project updatedAt
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'projects', currentProject.id), {
        updatedAt: Timestamp.now()
      });

      alert("Workflow saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save workflow");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchWorkflows = async () => {
    if (!auth.currentUser || !currentProject) return;
    setIsLoadingWorkflows(true);
    try {
      const q = query(
        collection(db, 'workflows'),
        where('userId', '==', auth.currentUser.uid),
        where('projectId', '==', currentProject.id),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWorkflows(docs);
    } catch (error) {
      console.error("Error fetching workflows:", error);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const loadWorkflow = (workflow: any) => {
    setNodes(workflow.nodes);
    setEdges(workflow.edges);
    setShowWorkflows(false);
  };

  const handleRunAll = () => {
    const nodesToRun = nodes.filter(n => 
      ['prompt', 'vision', 'imagen', 'nanoBanana', 'veo', 'imageToVideo', 'lyria'].includes(n.data.type)
    );
    
    for (const node of nodesToRun) {
      updateNodeData(node.id, { triggerRun: Date.now() });
    }
  };

  const handleClear = () => {
    if (confirm("Clear entire canvas?")) {
      setNodes([]);
      setEdges([]);
    }
  };

  return (
    <div className="h-16 bg-[#111111] border-b border-[#1a1a1a] flex items-center justify-between px-6 relative z-50">
      <div className="flex items-center gap-4">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] rounded-lg text-xs font-bold text-gray-300 transition-all disabled:opacity-50"
        >
          <Save className={`w-3.5 h-3.5 text-[#0097A7] ${isSaving ? 'animate-pulse' : ''}`} />
          {isSaving ? 'SAVING...' : 'SAVE'}
        </button>
        
        <div className="relative">
          <button 
            onClick={() => {
              setShowWorkflows(!showWorkflows);
              if (!showWorkflows) fetchWorkflows();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] rounded-lg text-xs font-bold text-gray-300 transition-all"
          >
            <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
            LIBRARY
          </button>

          <AnimatePresence>
            {showWorkflows && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-12 left-0 w-64 bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Project Workflows</h3>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {isLoadingWorkflows ? (
                    <div className="py-8 text-center text-[10px] text-gray-500">Loading...</div>
                  ) : workflows.length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-gray-500">No saved workflows</div>
                  ) : (
                    workflows.map((wf) => (
                      <button
                        key={wf.id}
                        onClick={() => loadWorkflow(wf)}
                        className="w-full text-left p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors group"
                      >
                        <p className="text-[11px] text-gray-300 font-medium truncate group-hover:text-[#0097A7]">{wf.name}</p>
                        <p className="text-[9px] text-gray-500">
                          {wf.createdAt instanceof Timestamp ? new Date(wf.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={handleRunAll}
          className="flex items-center gap-2 px-6 py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-black transition-all shadow-[0_0_15px_rgba(0,151,167,0.3)]"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          RUN ALL NODES
        </button>
        
        <div className="h-6 w-px bg-[#1a1a1a]" />
        
        <button 
          onClick={handleClear}
          className="p-2 bg-[#1a1a1a] hover:bg-red-950/30 border border-[#2a2a2a] hover:border-red-500/50 rounded-lg text-gray-500 hover:text-red-500 transition-all"
          title="Clear Canvas"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
