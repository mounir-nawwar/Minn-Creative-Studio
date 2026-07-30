import { useQuery } from '@tanstack/react-query';
import { chatsApi, Chat, ChatMessage } from '../../lib/api';
import { queryKeys } from './keys';

/**
 * Shared message snapshot for the active chat. The ChatDrawer reads it directly;
 * ChatStudio reconciles it into its optimistic local state (skipping while a
 * generation is in flight). Sharing the key means both poll once, not twice.
 */
export function useChatMessagesQuery(chatId?: string | null) {
  return useQuery<Chat & { messages: ChatMessage[] }>({
    queryKey: queryKeys.chat(chatId),
    queryFn: () => chatsApi.get(chatId!),
    enabled: !!chatId,
    refetchInterval: 4000,
  });
}
