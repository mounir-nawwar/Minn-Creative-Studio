import { useState } from 'react';
import { ArrowLeft, Sparkles, FileOutput, Loader2 } from 'lucide-react';
import { chatsApi } from '../../lib/api';
import type { User, Chat } from '../../lib/api';
import { toast } from '../../store/useToastStore';
import { mergeProjectData } from '../../services/geminiService';
import ProfileMenu from '../ProfileMenu';
import StudioModeToggle from '../StudioModeToggle';
import MoveToProjectDialog from '../Library/MoveToProjectDialog';
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
  const { currentProject, clearProject, openSettings, setSettingsPrefill } = useProjectStore();
  const playground = isPlaygroundProject(currentProject);
  const [chatToMove, setChatToMove] = useState<Chat | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
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

  const handleExtractToProject = async () => {
    if (!currentProject || messages.length === 0 || isExtracting) return;
    setIsExtracting(true);
    try {
      const transcript = messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      const merged = await mergeProjectData(transcript, currentProject);
      setSettingsPrefill({
        type: merged.projectType,
        subtype: merged.projectSubtype,
        name: merged.name,
        description: merged.description,
        clientName: merged.clientName,
        primaryColor: merged.primaryColor,
        secondaryColor: merged.secondaryColor,
        accentColor: merged.accentColor,
        visualMood: merged.visualMood,
        styleKeywords: merged.styleKeywords,
        negativeKeywords: merged.negativeKeywords,
        targetAudience: merged.targetAudience,
        brandPersonality: merged.brandPersonality?.[0],
        aiInstructions: merged.aiInstructions,
      });
      openSettings('edit');
    } catch (err) {
      toast.error('Extraction failed', err instanceof Error ? err.message : 'Could not extract project info from this chat');
    } finally {
      setIsExtracting(false);
    }
  };

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
          {!playground && messages.length > 0 && (
            <button
              onClick={handleExtractToProject}
              disabled={isExtracting}
              title="Pull everything from this chat into the project's fields — you'll review before anything saves"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/[0.04] px-3.5 text-[13px] font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,box-shadow] duration-150 hover:text-white hover:ring-white/20 active:scale-[0.96] disabled:opacity-50"
            >
              {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileOutput className="h-3.5 w-3.5" />}
              Extract to project
            </button>
          )}
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
          onMove={setChatToMove}
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

      {/* Move a session (and its generated assets) into a client project */}
      <MoveToProjectDialog
        open={!!chatToMove}
        onOpenChange={(o) => { if (!o) setChatToMove(null); }}
        subject={chatToMove?.title ?? ''}
        excludeProjectId={currentProject?.id}
        onConfirm={async (targetProjectId) => {
          if (!chatToMove) return;
          try {
            await chatsApi.update(chatToMove.id, { projectId: targetProjectId, moveAssets: true });
            if (activeChatId === chatToMove.id) setActiveChatId(null);
            toast.success('Session moved', 'The chat and its generated assets now live in the project');
          } catch (err) {
            toast.error('Move failed', err instanceof Error ? err.message : 'Could not move the session');
          }
        }}
      />
    </div>
  );
}
