import { useQuery } from '@tanstack/react-query';
import { chatsApi, Chat } from '../../lib/api';
import { queryKeys } from './keys';

/**
 * Shared chats list for a project. `chatsApi.list()` returns every chat; we
 * filter to the current project here so all three consumers (ChatDrawer,
 * ChatStudio, sidebar ChatsTab) share one cache entry. Consumers sort as needed.
 */
export function useChatsQuery(projectId?: string | null) {
  return useQuery<Chat[]>({
    queryKey: queryKeys.chats(projectId),
    queryFn: async () => {
      const all = await chatsApi.list();
      return projectId ? all.filter((c) => c.project_id === projectId) : [];
    },
    enabled: !!projectId,
    refetchInterval: 4000,
  });
}
