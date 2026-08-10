import { useQuery } from '@tanstack/react-query';
import { usageApi, getAccessToken, UsageSummary } from '../../lib/api';
import { queryKeys } from './keys';

/**
 * Total Vertex spend across every project (playground included) plus the
 * remaining free credit. Shared, so the profile menu and anything else showing
 * spend read one cached value.
 */
export function useUsageSummaryQuery() {
  return useQuery<UsageSummary>({
    queryKey: queryKeys.usage,
    queryFn: () => usageApi.summary(),
    enabled: !!getAccessToken(),
    refetchInterval: 10000,
  });
}
