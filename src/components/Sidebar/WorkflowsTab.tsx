import { motion } from 'motion/react';
import { Plus, Layout, Clock, Copy, Trash2 } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectStore } from '../../store/useProjectStore';
import { useStore } from '../../store/useStore';
import { workflowsApi, auth } from '../../lib/api';
import { useWorkflowsQuery } from '../../hooks/queries/useWorkflowsQuery';
import { queryKeys } from '../../hooks/queries/keys';
import { validateWorkflow } from '../../lib/workflowValidation';
import { Skeleton } from '../Skeleton';

export default function WorkflowsTab() {
  const { currentProject, setActiveWorkflowId, activeWorkflowId: currentWfId } = useProjectStore();
  const { setNodes, setEdges } = useStore();
  const queryClient = useQueryClient();
  const { data, isLoading } = useWorkflowsQuery(currentProject?.id);
  const workflows = (data ?? []) as any[];

  const invalidateWorkflows = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows(currentProject?.id) });

  const createNewWorkflow = async () => {
    if (!currentProject || !auth.getCurrentUser()) return;
    try {
      await workflowsApi.create({ projectId: currentProject.id, name: `Workflow ${new Date().toLocaleTimeString()}`, nodes: [], edges: [] });
      invalidateWorkflows();
    } catch (err) {
      console.error('Error creating workflow:', err);
    }
  };

  const duplicateWorkflow = async (e: React.MouseEvent, workflow: any) => {
    e.stopPropagation();
    if (!currentProject || !auth.getCurrentUser()) return;
    try {
      await workflowsApi.create({ projectId: currentProject.id, name: `${workflow.name} (Copy)`, nodes: workflow.nodes || [], edges: workflow.edges || [] });
      invalidateWorkflows();
    } catch (err) {
      console.error('Error duplicating workflow:', err);
    }
  };

  const deleteWorkflow = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this workflow?')) return;
    try {
      await workflowsApi.delete(id);
      if (currentWfId === id) {
        setActiveWorkflowId(null);
        setNodes([]);
        setEdges([]);
      }
      invalidateWorkflows();
      const remaining = workflows.filter((w) => w.id !== id);
      if (remaining.length > 0) {
        loadWorkflow(remaining[0]);
      } else if (currentProject) {
        const created = await workflowsApi.create({
          projectId: currentProject.id,
          name: 'Main Workflow',
          nodes: [],
          edges: [],
        });
        setActiveWorkflowId(created.id);
        setNodes([]);
        setEdges([]);
        invalidateWorkflows();
      }
    } catch (err) {
      console.error('Error deleting workflow:', err);
    }
  };

  const loadWorkflow = (wf: any) => {
    const validated = validateWorkflow(wf);
    if (!validated) return;
    setNodes(validated.nodes as unknown as Node[]);
    setEdges(validated.edges as unknown as Edge[]);
    setActiveWorkflowId(validated.id || null);
  };

  const formatDate = (dateValue: string | Date | undefined): string => {
    if (!dateValue) return 'Just now';
    try {
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      return date.toLocaleDateString();
    } catch {
      return 'Just now';
    }
  };

  return (
    <motion.div
      key="workflows"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="p-3">
        <button
          onClick={createNewWorkflow}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0097A7]/10 text-[13px] font-medium text-[#0097A7] ring-1 ring-[#0097A7]/20 transition-[transform,background-color] duration-150 hover:bg-[#0097A7]/15 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New workflow
        </button>
      </div>

      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : workflows.length === 0 ? (
          <div className="space-y-3 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
              <Layout className="h-5 w-5 text-gray-600" />
            </div>
            <p className="text-xs text-gray-500">No workflows yet</p>
          </div>
        ) : (
          workflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => loadWorkflow(wf)}
              className={`group relative cursor-pointer rounded-xl bg-white/[0.03] p-3 ring-1 transition-[background-color,box-shadow] duration-150 ${
                currentWfId === wf.id ? 'bg-[#0097A7]/[0.06] ring-[#0097A7]/50' : 'ring-white/10 hover:ring-[#0097A7]/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-black/40 ring-1 ring-inset ring-white/10">
                  {wf.thumbnailUrl ? <img src={wf.thumbnailUrl} className="h-full w-full object-cover" /> : <Layout className="h-5 w-5 text-gray-700" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-[13px] font-medium text-white transition-colors group-hover:text-[#0097A7]">{wf.name}</h4>
                  <div className="mt-0.5 flex items-center gap-1.5 text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span className="text-[11px] tabular-nums">{formatDate(wf.created_at || wf.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="absolute right-2 top-2 flex gap-0.5">
                <button
                  onClick={(e) => duplicateWorkflow(e, wf)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 opacity-0 transition-[opacity,color] duration-150 hover:text-[#0097A7] group-hover:opacity-100"
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => deleteWorkflow(e, wf.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 opacity-0 transition-[opacity,color] duration-150 hover:text-red-400 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
