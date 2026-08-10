/**
 * Central query-key factory for TanStack Query.
 *
 * Consumers read data through the shared query hooks in this folder and
 * invalidate with these exact keys after a mutation, so every component that
 * shares a key also shares one in-flight request + cache entry (this is what
 * collapses the old duplicate polling loops).
 */
export const queryKeys = {
  projects: ['projects'] as const,
  workflows: (projectId?: string | null) => ['workflows', projectId ?? null] as const,
  chats: (projectId?: string | null) => ['chats', projectId ?? null] as const,
  chat: (chatId?: string | null) => ['chat', chatId ?? null] as const,
  usage: ['usage', 'summary'] as const,
};
