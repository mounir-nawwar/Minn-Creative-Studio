import { ArrowLeft, Sparkles } from 'lucide-react';
import type { User } from '../../lib/api';
import ProfileMenu from '../ProfileMenu';
import StudioModeToggle from '../StudioModeToggle';
import { useProjectStore, isPlaygroundProject } from '../../store/useProjectStore';
import { useChatStudio } from './useChatStudio';
import ChatHistoryRail from './ChatHistoryRail';
import ChatThread from './ChatThread';
import ChatComposer from './ChatComposer';
import GenerationSettingsPanel from './GenerationSettingsPanel';

interface ChatStudioProps {
  user: User;
  onLogout: () => void;
}

/**
 * Full-screen conversational creation workspace (Google-AI-Studio-style).
 * Rendered by App when studioMode === 'chat'.
 */
export default function ChatStudio({ user, onLogout }: ChatStudioProps) {
  const { currentProject, clearProject } = useProjectStore();
  const playground = isPlaygroundProject(currentProject);
  const {
    chats,
    messages,
    pending,
    isGenerating,
    settings,
    setSettings,
    activeChatId,
    setActiveChatId,
    createNewChat,
    deleteChat,
    sendMessage,
  } = useChatStudio();

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0a0a] px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={clearProject}
            aria-label="Back to projects"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/[0.06] hover:text-white active:scale-[0.96]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0097A7]">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-white">Chat Studio</p>
              {playground ? (
                <span className="inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-[#0097A7] ring-1 ring-[#0097A7]/40">
                  Playground
                </span>
              ) : (
                <p className="truncate text-xs leading-tight text-gray-500">{currentProject?.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StudioModeToggle />
          <div className="h-7 w-px bg-white/10" />
          <ProfileMenu user={user} onLogout={onLogout} variant="avatar" />
        </div>
      </header>

      {/* Workspace body */}
      <div className="flex min-h-0 flex-1">
        <ChatHistoryRail
          chats={chats}
          activeChatId={activeChatId}
          onSelect={setActiveChatId}
          onNew={createNewChat}
          onDelete={deleteChat}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <ChatThread
            messages={messages}
            pending={pending}
            hasActiveChat={!!activeChatId}
            onStartChat={createNewChat}
          />
          <ChatComposer mode={settings.mode} disabled={isGenerating} onSend={sendMessage} />
        </main>

        <GenerationSettingsPanel settings={settings} onChange={setSettings} disabled={isGenerating} />
      </div>
    </div>
  );
}
