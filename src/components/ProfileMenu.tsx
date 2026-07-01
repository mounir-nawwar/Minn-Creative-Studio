import * as Avatar from '@radix-ui/react-avatar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, ChevronDown } from 'lucide-react';
import type { User } from '../lib/api';

interface ProfileMenuProps {
  user: User | null;
  onLogout: () => void;
  /** `chip` = avatar + name + chevron in a pill (picker); `avatar` = circle only (toolbar). */
  variant?: 'chip' | 'avatar';
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase() || '?';
}

function AvatarBadge({ user, size = 'h-8 w-8' }: { user: User | null; size?: string }) {
  return (
    <Avatar.Root className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full`}>
      <Avatar.Image src={user?.photoUrl || undefined} alt={user?.displayName || ''} className="h-full w-full object-cover" />
      <Avatar.Fallback className="flex h-full w-full items-center justify-center bg-[#0097A7]/15 text-[11px] font-semibold text-[#0097A7]">
        {getInitials(user?.displayName)}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}

export default function ProfileMenu({ user, onLogout, variant = 'avatar' }: ProfileMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {variant === 'chip' ? (
          <button
            type="button"
            aria-label="Account menu"
            className="group inline-flex h-9 items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 ring-1 ring-white/10 transition-[box-shadow] duration-150 hover:ring-white/20 focus:outline-none data-[state=open]:ring-[#0097A7]/50"
          >
            <AvatarBadge user={user} />
            <ChevronDown className="h-3.5 w-3.5 text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Account menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-white/10 transition-[box-shadow] duration-150 hover:ring-white/20 focus:outline-none data-[state=open]:ring-[#0097A7]/50"
          >
            <AvatarBadge user={user} />
          </button>
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="z-[200] min-w-[224px] origin-top rounded-xl bg-[#0d0d0d] p-1.5 ring-1 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:menuIn_140ms_cubic-bezier(0.2,0,0,1)] data-[state=closed]:[animation:menuOut_110ms_ease-in]"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            <div className="ring-1 ring-inset ring-white/10 rounded-full">
              <AvatarBadge user={user} size="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.displayName}</p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-white/10" />

          <DropdownMenu.Item
            onSelect={onLogout}
            className="flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-sm text-gray-300 outline-none transition-colors duration-100 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
