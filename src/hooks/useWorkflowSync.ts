import { useCallback, useEffect, useRef } from 'react';
import type { Edge } from 'reactflow';
import { workflowsApi } from '../lib/api';
import { useStore } from '../store/useStore';
import { toast } from '../store/useToastStore';
import { mergeGraphs, type CanvasNode } from '../lib/graphMerge';

/**
 * Live canvas sync.
 *
 * The canvas historically loaded a workflow once and then only ever wrote to
 * it — so anything written by someone else (the other user, or Claude through
 * the MCP connector: added nodes, graph edits, run outputs) was invisible
 * until reload, and the next local auto-save would overwrite it wholesale.
 *
 * This hook polls a cheap version endpoint while a workflow is open and pulls
 * foreign changes in:
 *
 * - **Clean canvas** (no unsaved local edits): adopt the server graph outright.
 * - **Dirty canvas** (user is mid-edit): merge instead of clobbering — keep the
 *   local position/config/label of nodes the user is touching, take the
 *   server's generated results (output/outputs/error) and any new nodes/edges.
 *
 * Polling, not SSE: `EventSource` cannot send the `Authorization: Bearer`
 * header this app authenticates with, and Cloudflare buffers long-lived
 * streams. A 3s probe of a timestamp is cheap, survives the proxy, and is well
 * inside "feels live" for a two-person tool.
 */

const POLL_INTERVAL_MS = 3000;

interface UseWorkflowSyncOptions {
  workflowId: string | null;
  /** This canvas's save token — the version probe echoes it so we can ignore our own writes. */
  clientToken: string;
  /** True while local edits are waiting for the debounced auto-save. */
  isDirty: () => boolean;
  /** Called before the hook writes to the store, so the canvas can skip the resulting auto-save. */
  onBeforeApply: () => void;
}

export function useWorkflowSync({ workflowId, clientToken, isDirty, onBeforeApply }: UseWorkflowSyncOptions) {
  const setNodes = useStore((s) => s.setNodes);
  const setEdges = useStore((s) => s.setEdges);

  /** The server revision our local state is known to correspond to. */
  const syncedAtRef = useRef<string | null>(null);
  const applyingRef = useRef(false);

  /** Canvas calls this after its own save so we don't treat our echo as foreign. */
  const markSaved = useCallback((updatedAt: string) => {
    syncedAtRef.current = updatedAt;
  }, []);

  const markLoaded = useCallback((updatedAt: string) => {
    syncedAtRef.current = updatedAt;
  }, []);

  useEffect(() => {
    if (!workflowId) {
      syncedAtRef.current = null;
      return;
    }

    let cancelled = false;

    const pull = async () => {
      if (cancelled || applyingRef.current) return;
      try {
        const version = await workflowsApi.getVersion(workflowId);
        if (cancelled) return;

        // First observation: adopt it as our baseline (the canvas loaded this graph).
        if (!syncedAtRef.current) {
          syncedAtRef.current = version.updatedAt;
          return;
        }
        if (version.updatedAt === syncedAtRef.current) return;

        // Our own save — recognized by the echoed token regardless of when the
        // PUT response landed. Advance the baseline silently; never toast.
        if (version.token && version.token === clientToken) {
          syncedAtRef.current = version.updatedAt;
          return;
        }

        const remote = await workflowsApi.get(workflowId);
        if (cancelled) return;

        applyingRef.current = true;
        const state = useStore.getState();
        const remoteGraph = {
          nodes: (remote.nodes ?? []) as CanvasNode[],
          edges: (remote.edges ?? []) as Edge[],
        };

        // Genuine foreign change. Advance the baseline in BOTH branches so a
        // single external revision toasts once, not every poll tick.
        if (!isDirty()) {
          onBeforeApply();
          setNodes(remoteGraph.nodes);
          setEdges(remoteGraph.edges);
          syncedAtRef.current = remote.updated_at;
          toast.info('Workflow updated', 'Changes from Claude or your teammate are now on the canvas');
        } else {
          const merged = mergeGraphs(
            { nodes: state.nodes as CanvasNode[], edges: state.edges },
            remoteGraph
          );
          if (merged.changed) {
            onBeforeApply();
            setNodes(merged.nodes);
            setEdges(merged.edges);
            toast.info('Workflow updated', 'Merged changes from Claude or your teammate — your edits were kept');
          }
          syncedAtRef.current = remote.updated_at;
        }
      } catch (err) {
        // Offline/refresh races are expected — the next tick retries.
        if (import.meta.env.DEV) console.warn('[WorkflowSync] poll failed', err);
      } finally {
        applyingRef.current = false;
      }
    };

    const interval = setInterval(pull, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workflowId, clientToken, isDirty, onBeforeApply, setNodes, setEdges]);

  return { markSaved, markLoaded };
}
