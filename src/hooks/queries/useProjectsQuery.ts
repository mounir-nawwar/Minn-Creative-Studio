import { useQuery } from '@tanstack/react-query';
import { projectsApi, getAccessToken, Project as ApiProject } from '../../lib/api';
import { queryKeys } from './keys';

/**
 * Shared projects list. Gated on an access token so it never fires while logged
 * out (the old hook checked this per-poll to avoid 401 spam at the app root).
 */
export function useProjectsQuery() {
  return useQuery<ApiProject[]>({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
    enabled: !!getAccessToken(),
    refetchInterval: 5000,
  });
}
