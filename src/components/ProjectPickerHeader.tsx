import { Plus, Search, FlaskConical, MessageSquare, Workflow, Library } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { User } from '../lib/api';
import type { StudioMode } from '../store/useProjectStore';
import ProfileMenu from './ProfileMenu';
import MinnLogo from '../assets/Minn.svg';

interface ProjectPickerHeaderProps {
  user: User | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewProject: () => void;
  onEnterPlayground: (mode: StudioMode) => void;
  onOpenLibrary: () => void;
  onLogout: () => void;
}

export default function ProjectPickerHeader({
  user,
  searchQuery,
  onSearchChange,
  onNewProject,
  onEnterPlayground,
  onOpenLibrary,
  onLogout,
}: ProjectPickerHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-4 px-6">
        {/* Brand */}
        <a href="/" className="flex shrink-0 items-center" aria-label="MINN Studio">
          <img src={MinnLogo} alt="MINN STUDIO" className="h-[18px] w-auto" />
        </a>

        <div className="h-6 w-px bg-white/10" />

        {/* Search */}
        <div className="group relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors duration-150 group-focus-within:text-[#0097A7]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects or clients"
            className="h-9 w-[300px] rounded-lg bg-white/[0.04] pl-9 pr-3 text-sm text-white placeholder:text-gray-500 ring-1 ring-white/10 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60"
          />
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2.5">
          {/* Library — every asset across all projects */}
          <button
            type="button"
            onClick={onOpenLibrary}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium text-gray-300 ring-1 ring-white/10
              transition-[transform,color,box-shadow] duration-150 hover:text-white hover:ring-white/20 active:scale-[0.96]"
          >
            <Library className="h-4 w-4" />
            Library
          </button>

          {/* Playground — jump straight in, no project fields */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0097A7]/10 px-3.5 text-sm font-medium text-[#0097A7] ring-1 ring-[#0097A7]/25
                  transition-[transform,background-color,box-shadow] duration-150 hover:bg-[#0097A7]/15 active:scale-[0.96] data-[state=open]:ring-[#0097A7]/50 focus:outline-none"
              >
                <FlaskConical className="h-4 w-4" />
                Playground
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-[200] w-56 rounded-xl bg-[#0d0d0d] p-1.5 ring-1 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:menuIn_140ms_cubic-bezier(0.2,0,0,1)]"
              >
                <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                  Scratch space — no project needed
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  onSelect={() => onEnterPlayground('chat')}
                  className="flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-gray-300 outline-none transition-colors duration-100 data-[highlighted]:bg-white/5 data-[highlighted]:text-white"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#0097A7]" />
                  Chat Studio
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => onEnterPlayground('canvas')}
                  className="flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-gray-300 outline-none transition-colors duration-100 data-[highlighted]:bg-white/5 data-[highlighted]:text-white"
                >
                  <Workflow className="h-3.5 w-3.5 text-[#0097A7]" />
                  Canvas
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0097A7] pl-2.5 pr-3.5 text-sm font-medium text-white
              shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-6px_rgba(0,151,167,0.7)]
              transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New Project
          </button>

          {/* Profile */}
          <ProfileMenu user={user} onLogout={onLogout} variant="chip" />
        </div>
      </div>
    </header>
  );
}
