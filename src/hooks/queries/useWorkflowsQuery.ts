import { useQuery } from '@tanstack/react-query';
import { workflowsApi, auth, Workflow } from '../../lib/api';
import { queryKeys } from './keys';

/**
 * Shared workflows list for a project. Consumed by both the canvas Toolbar and
 * the sidebar WorkflowsTab — sharing one query key collapses what used to be two
 * identical 5s polls into one.
 */
export function useWorkflowsQuery(projectId?: string | null) {
  return useQuery<Workflow[]>({
    queryKey: queryKeys.workflows(projectId),
    queryFn: () => workflowsApi.list(projectId!),
    enabled: !!projectId && !!auth.getCurrentUser(),
    refetchInterval: 5000,
  });
}
