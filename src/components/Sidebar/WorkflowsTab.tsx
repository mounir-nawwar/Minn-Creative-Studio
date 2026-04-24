import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Layout, Clock, Copy, Trash2 } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { useProjectStore } from '../../store/useProjectStore';
import { useStore } from '../../store/useStore';
import {
  db, auth, collection, query, where, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp, Timestamp
} from '../../firebase';
import { validateWorkflow } from '../../lib/workflowValidation';
import { Skeleton } from '../Skeleton';

export default function WorkflowsTab() {
  const { currentProject, setActiveWorkflowId, activeWorkflowId: currentWfId } = useProjectStore();
  const { setNodes, setEdges } = useStore();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentProject || !auth.currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const q = query(
      collection(db, 'workflows'),
      where('projectId', '==', currentProject.id),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setWorkflows(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
  }, [currentProject?.id]);

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

  const duplicateWorkflow = async (e: React.MouseEvent, workflow: any) => {
    e.stopPropagation();
    if (!currentProject || !auth.currentUser) return;
    await addDoc(collection(db, 'workflows'), {
      name: `${workflow.name} (Copy)`,
      projectId: currentProject.id,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
      thumbnailUrl: workflow.thumbnailUrl || null
    });
  };

  const deleteWorkflow = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this workflow?')) return;
    try {
      await deleteDoc(doc(db, 'workflows', id));
      if (currentWfId === id) {
        setActiveWorkflowId(null);
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.error('Error deleting workflow:', err);
    }
  };

  const loadWorkflow = (wf: any) => {
    const validated = validateWorkflow(wf);
    if (!validated) {
      console.error('[WorkflowsTab] Cannot load invalid workflow');
      return;
    }
    setNodes(validated.nodes as unknown as Node[]);
    setEdges(validated.edges as unknown as Edge[]);
    setActiveWorkflowId(validated.id || null);
  };

  return (
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
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#111111] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : workflows.length === 0 ? (
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
              onClick={() => loadWorkflow(wf)}
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
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={(e) => duplicateWorkflow(e, wf)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-[#0097A7] transition-all"
                  title="Duplicate Workflow"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => deleteWorkflow(e, wf.id)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all"
                  title="Delete Workflow"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
