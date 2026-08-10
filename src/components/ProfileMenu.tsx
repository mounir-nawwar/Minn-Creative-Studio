import { useState } from 'react';
import * as Avatar from '@radix-ui/react-avatar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, ChevronDown, RotateCcw, Loader2 } from 'lucide-react';
import type { User } from '../lib/api';
import { usageApi } from '../lib/api';
import { useUsageSummaryQuery } from '../hooks/queries/useUsageSummaryQuery';
import { queryKeys } from '../hooks/queries/keys';
import { toast } from '../store/useToastStore';

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

const money = (n: number) => `$${(n || 0).toFixed(2)}`;

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: usage } = useUsageSummaryQuery();

  const resetUsage = useMutation({
    mutationFn: () => usageApi.reset(),
    onSuccess: (result) => {
      // Project cards and the context bar read the same numbers.
      queryClient.invalidateQueries({ queryKey: queryKeys.usage });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      setConfirmOpen(false);
      toast.success('Usage reset', `Cleared ${money(result.clearedCost)} of tracked spend`);
    },
    onError: (err: unknown) => {
      toast.error('Reset failed', err instanceof Error ? err.message : 'Could not reset usage');
    },
  });

  const spent = usage?.totalCost ?? 0;
  const limit = usage?.creditLimit ?? 300;
  const remaining = usage?.remaining ?? limit;
  const usedPct = Math.round((usage?.usedFraction ?? 0) * 100);
  const exhausted = remaining <= 0;

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
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
            className="z-[200] min-w-[268px] origin-top rounded-xl bg-[#0d0d0d] p-1.5 ring-1 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:menuIn_140ms_cubic-bezier(0.2,0,0,1)] data-[state=closed]:[animation:menuOut_110ms_ease-in]"
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

            {/* Vertex spend, across every project + the playground */}
            <div className="px-2.5 pb-1 pt-2">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Total spend</span>
                <span className="text-sm font-semibold tabular-nums text-white">{money(spent)}</span>
              </div>

              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[11px] text-gray-400">Credit left</span>
                <span className={`text-[13px] font-medium tabular-nums ${exhausted ? 'text-red-400' : 'text-[#0097A7]'}`}>
                  {money(remaining)}
                  <span className="text-gray-600"> / {money(limit)}</span>
                </span>
              </div>

              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
                role="progressbar"
                aria-valuenow={usedPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Credit used"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${exhausted ? 'bg-red-500/70' : 'bg-[#0097A7]'}`}
                  style={{ width: `${Math.min(Math.max(usedPct, 0), 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-gray-600">{usedPct}% of credit used · all projects</p>

              <button
                type="button"
                onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                className="mt-2.5 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium text-gray-400 ring-1 ring-white/10 transition-[transform,color,background-color,box-shadow] duration-150 hover:bg-white/5 hover:text-white hover:ring-white/20 active:scale-[0.96]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset usage
              </button>
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

      {/* Kept outside the menu so it survives the dropdown unmounting */}
      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[300] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0b0b0b] p-5 ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
            <AlertDialog.Title className="text-base font-semibold text-white">Reset usage history?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-gray-400">
              Clears the tracked spend on <span className="text-gray-200">every project and the playground</span>, and
              empties the per-generation usage log. The counter restarts at {money(0)} with the full {money(limit)} credit.
              <span className="mt-2 block text-xs text-gray-500">
                Currently tracking {money(spent)}. A backup of the database is saved on the server first.
              </span>
            </AlertDialog.Description>

            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <button
                onClick={() => resetUsage.mutate()}
                disabled={resetUsage.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-500/90 px-4 text-sm font-medium text-white transition-[transform,background-color] duration-150 hover:bg-red-500 active:scale-[0.96] disabled:opacity-50"
              >
                {resetUsage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Reset usage
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
