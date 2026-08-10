import { useState, useEffect, useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { User, workflowsApi } from '../lib/api';
import { useWorkflowsQuery } from '../hooks/queries/useWorkflowsQuery';
import { queryKeys } from '../hooks/queries/keys';
import { Play, Save, Trash2, X, Clock, Loader2, ChevronDown, Zap, Pencil, Library } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import ProfileMenu from './ProfileMenu';
import StudioModeToggle from './StudioModeToggle';
import LibraryDialog from './Library/LibraryDialog';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import { stripUndefined } from '../lib/utils';
import { validateWorkflow } from '../lib/workflowValidation';

interface ToolbarProps { user: User | null; onLogout: () => void; }

const Toolbar = ({ user, onLogout }: ToolbarProps) => {
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const setNodes = useStore((state) => state.setNodes);
  const setEdges = useStore((state) => state.setEdges);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject, activeWorkflowId, setActiveWorkflowId, uploadEnabled, setUploadEnabled } = useProjectStore();

  const queryClient = useQueryClient();
  const { data: workflowsData } = useWorkflowsQuery(currentProject?.id);
  const workflows = (workflowsData ?? []) as any[];

  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const activeWorkflowIdRef = useRef(activeWorkflowId);
  const confirmSaveRef = useRef<((isAuto?: boolean) => Promise<void>) | null>(null);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);
  useEffect(() => { activeWorkflowIdRef.current = activeWorkflowId; }, [activeWorkflowId]);

  const invalidateWorkflows = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows(currentProject?.id) });

  useEffect(() => { setHasUnsavedChanges(true); }, [nodes, edges]);

  // Auto-save every 2 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      if (hasUnsavedChangesRef.current && activeWorkflowIdRef.current) {
        confirmSaveRef.current?.(true);
      }
    }, 120000);
    return () => clearInterval(timer);
  }, []);

  // Cmd/Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeWorkflowIdRef.current) confirmSaveRef.current?.();
        else setShowSaveModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSave = () => {
    if (!user || !currentProject) return;
    if (activeWorkflowId) {
      const currentWf = workflows.find((w) => w.id === activeWorkflowId);
      setWorkflowName(currentWf?.name || '');
      confirmSave();
    } else {
      setWorkflowName(`Workflow ${new Date().toLocaleDateString()}`);
      setShowSaveModal(true);
    }
  };

  const confirmSave = async (isAuto = false) => {
    if (!currentProject || !user) return;
    setIsSaving(true);
    try {
      const sanitizedNodes = await Promise.all(nodes.map(async (node) => {
        const data = { ...node.data };
        if (data.output && typeof data.output === 'string' && data.output.startsWith('data:')) {
          try {
            const fetchRes = await fetch(data.output);
            const blob = await fetchRes.blob();
            const ext = blob.type.includes('video') ? 'mp4' : blob.type.includes('audio') ? 'mp3' : 'png';
            const file = new File([blob], `output-${node.id}.${ext}`, { type: blob.type });
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', currentProject.id);
            const response = await fetch(`${API_BASE}/upload`, { method: 'POST', headers: { ...authHeader() }, body: formData });
            if (response.ok) {
              const { url } = await response.json();
              data.output = url;
            } else {
              data.output = null;
            }
          } catch {
            data.output = null;
          }
        }
        data.isRunning = false;
        data.error = null;
        data.progress = 0;
        return { id: node.id, type: node.type, position: node.position, data: stripUndefined(data) };
      }));

      const sanitizedEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        type: e.type ?? null,
        animated: e.animated ?? false,
        data: e.data ? stripUndefined(e.data) : null,
      }));

      if (activeWorkflowId) {
        await workflowsApi.update(activeWorkflowId, {
          name: workflows.find((w) => w.id === activeWorkflowId)?.name || `Workflow ${new Date().toLocaleDateString()}`,
          nodes: sanitizedNodes,
          edges: sanitizedEdges,
        });
      } else {
        const newWorkflow = await workflowsApi.create({
          projectId: currentProject.id,
          name: workflowName || `Workflow ${new Date().toLocaleDateString()}`,
          nodes: sanitizedNodes,
          edges: sanitizedEdges,
        });
        setActiveWorkflowId(newWorkflow.id);
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setShowSaveModal(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => { confirmSaveRef.current = confirmSave; });

  const deleteWorkflow = async (id: string) => {
    if (!window.confirm('Delete this workflow?')) return;
    try {
      await workflowsApi.delete(id);
      if (activeWorkflowId === id) {
        setActiveWorkflowId(null);
        setNodes([]);
        setEdges([]);
        setWorkflowName('');
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
        setWorkflowName(created.name);
        setNodes([]);
        setEdges([]);
        invalidateWorkflows();
      }
    } catch (err) {
      console.error('Error deleting workflow:', err);
    }
  };

  const loadWorkflow = (workflow: unknown) => {
    const validated = validateWorkflow(workflow);
    if (!validated) return;
    setNodes(validated.nodes as unknown as typeof nodes);
    setEdges(validated.edges as unknown as typeof edges);
    setActiveWorkflowId(validated.id || null);
    setWorkflowName(validated.name || '');
    setHasUnsavedChanges(false);
  };

  const handleRunAll = () => {
    const nodesToRun = nodes.filter((n) =>
      ['prompt', 'vision', 'imagen', 'nanoBanana', 'veo', 'imageToVideo', 'lyria'].includes(n.data.type),
    );
    for (const node of nodesToRun) updateNodeData(node.id, { triggerRun: Date.now() });
  };

  const handleRename = async () => {
    if (!activeWorkflowId || !tempName.trim()) { setIsEditingName(false); return; }
    const currentWf = workflows.find((w) => w.id === activeWorkflowId);
    if (currentWf && currentWf.name === tempName.trim()) { setIsEditingName(false); return; }
    try {
      await workflowsApi.update(activeWorkflowId, { name: tempName.trim(), nodes: currentWf?.nodes || [], edges: currentWf?.edges || [] });
      setIsEditingName(false);
    } catch (err) {
      console.error('Rename failed:', err);
      setIsEditingName(false);
    }
  };

  const activeName = activeWorkflowId ? workflows.find((w) => w.id === activeWorkflowId)?.name : 'Untitled workflow';

  return (
    <div className="z-10 flex h-16 items-center justify-between border-b border-white/5 bg-[#0a0a0a] px-6">
      {/* Left */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0097A7]">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            {isEditingName && activeWorkflowId ? (
              <input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                className="mb-0.5 border-b border-[#0097A7] bg-transparent text-sm font-medium text-white focus:outline-none"
                autoFocus
              />
            ) : (
              <button
                type="button"
                className={`group flex items-center gap-1.5 text-sm font-medium text-white ${activeWorkflowId ? 'transition-colors hover:text-[#0097A7]' : 'cursor-default'}`}
                onClick={() => {
                  if (activeWorkflowId) {
                    setTempName(workflows.find((w) => w.id === activeWorkflowId)?.name || '');
                    setIsEditingName(true);
                  }
                }}
              >
                <span className="truncate">{activeName}</span>
                {activeWorkflowId && <Pencil className="h-3 w-3 text-[#0097A7] opacity-0 transition-opacity group-hover:opacity-100" />}
              </button>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="truncate">{currentProject?.name}</span>
              {lastSaved && (
                <span className="flex items-center gap-1 text-[#0097A7]">
                  <Clock className="h-2.5 w-2.5" />
                  <span className="tabular-nums">Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="h-7 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          {/* Workflows dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 text-[13px] font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,box-shadow] duration-150 hover:text-white hover:ring-white/20 active:scale-[0.96] data-[state=open]:ring-[#0097A7]/40 focus:outline-none">
                Workflows
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 data-[state=open]:rotate-180" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={8}
                className="z-[200] max-h-72 w-64 overflow-y-auto rounded-xl bg-[#0d0d0d] p-1.5 ring-1 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:menuIn_140ms_cubic-bezier(0.2,0,0,1)]"
              >
                {workflows.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-gray-600">No saved workflows</p>
                ) : (
                  workflows.map((w) => (
                    <DropdownMenu.Item
                      key={w.id}
                      onSelect={(e) => {
                        const target = e.target as HTMLElement;
                        if (target?.closest('button[aria-label="Delete workflow"]')) {
                          e.preventDefault();
                          return;
                        }
                        loadWorkflow(w);
                      }}
                      className={`group flex h-9 cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 text-[13px] outline-none transition-colors duration-100 data-[highlighted]:bg-white/5 ${
                        activeWorkflowId === w.id ? 'text-[#0097A7]' : 'text-gray-300 data-[highlighted]:text-white'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Save className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{w.name}</span>
                      </span>
                      <button
                        type="button"
                        aria-label="Delete workflow"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteWorkflow(w.id); }}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-red-400 group-data-[highlighted]:opacity-100 opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenu.Item>
                  ))
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96] ${
              hasUnsavedChanges
                ? 'bg-[#0097A7] text-white hover:bg-[#00a9bb]'
                : 'bg-white/[0.04] text-gray-400 ring-1 ring-white/10'
            }`}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {activeWorkflowId ? 'Save' : 'Save workflow'}
          </button>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsLibraryOpen(true)}
          title="Library — all assets across projects"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 ring-1 ring-white/10 transition-[transform,color,box-shadow] duration-150 hover:text-white hover:ring-white/20 active:scale-[0.96]"
        >
          <Library className="h-4 w-4" />
        </button>

        <StudioModeToggle />

        <div className="h-7 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Upload</span>
          <ToggleSwitch checked={uploadEnabled} onChange={setUploadEnabled} size="navbar" />
        </div>

        <button
          onClick={handleRunAll}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0097A7] px-4 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-6px_rgba(0,151,167,0.7)] transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Run project
        </button>

        <ProfileMenu user={user} onLogout={onLogout} variant="avatar" />
      </div>

      <LibraryDialog
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        initialFilters={currentProject ? { projectId: currentProject.id } : undefined}
      />

      {/* Save workflow modal */}
      <Dialog.Root open={showSaveModal} onOpenChange={setShowSaveModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0b0b0b] ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Save className="h-4 w-4 text-[#0097A7]" />
                <Dialog.Title className="text-base font-semibold text-white">Save workflow</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]">
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <div className="space-y-4 p-5">
              <label className="block space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Workflow name</span>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="Enter a name…"
                  className="w-full rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 ring-1 ring-white/10 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && workflowName.trim()) confirmSave(); }}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={() => confirmSave()}
                  disabled={!workflowName.trim() || isSaving}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0097A7] px-4 text-sm font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save workflow'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default Toolbar;
