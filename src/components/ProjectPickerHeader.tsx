import { Plus, Search } from 'lucide-react';
import type { User } from '../lib/api';
import ProfileMenu from './ProfileMenu';
import MinnLogo from '../assets/Minn.svg';

interface ProjectPickerHeaderProps {
  user: User | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewProject: () => void;
  onLogout: () => void;
}

export default function ProjectPickerHeader({
  user,
  searchQuery,
  onSearchChange,
  onNewProject,
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
