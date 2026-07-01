import { useState } from 'react';
import { Project, PROJECT_TYPES, ProjectStatus } from '../types/project.types';
import { Clock, Briefcase, Trash2, Settings, Check, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectCardProps {
  project: Project;
  layout?: 'grid' | 'list';
  isShared?: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: ProjectStatus) => void;
}

const STATUSES: ProjectStatus[] = ['active', 'archived', 'completed'];

function formatDate(timestamp: unknown): string {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp as string | number | Date);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Shared, tactile icon button: 36px hit area, presses on click, no layout jump. */
function IconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 ring-1 ring-white/10 bg-black/50 backdrop-blur-md
        hover:text-white hover:ring-white/20 active:scale-[0.96]
        transition-[transform,color,box-shadow] duration-150 ${danger ? 'hover:text-red-400 hover:ring-red-500/30' : 'hover:text-[#0097A7] hover:ring-[#0097A7]/30'}`}
    >
      {children}
    </button>
  );
}

/** Status pill + dropdown. Calm fade, no bounce, no pulse. */
function StatusControl({
  status,
  onChange,
  placement,
}: {
  status: ProjectStatus;
  onChange: (s: ProjectStatus) => void;
  placement: 'bottom-left' | 'top-right';
}) {
  const [open, setOpen] = useState(false);
  const menuPos =
    placement === 'bottom-left' ? 'top-full left-0 mt-2' : 'bottom-full right-0 mb-2';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 items-center gap-2 rounded-full bg-black/55 px-3 backdrop-blur-md ring-1 ring-white/10
          hover:ring-[#0097A7]/40 active:scale-[0.96] transition-[transform,box-shadow] duration-150"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-[#0097A7]' : 'bg-gray-500'}`} />
        <span className="text-[11px] font-medium capitalize text-white">{status}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
            className={`absolute z-30 min-w-[150px] rounded-xl bg-[#0a0a0a] p-1 ring-1 ring-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.6)] ${menuPos}`}
          >
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(s);
                  setOpen(false);
                }}
                className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-[12px] capitalize transition-colors duration-150 ${
                  status === s ? 'bg-[#0097A7]/10 text-[#0097A7]' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {s}
                {status === s && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((c, i) => (
        <span
          key={i}
          className="h-4 w-4 rounded-full ring-1 ring-inset ring-white/10"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export default function ProjectCard({
  project,
  layout = 'grid',
  isShared,
  onClick,
  onEdit,
  onDelete,
  onStatusChange,
}: ProjectCardProps) {
  const projectType = PROJECT_TYPES[project.type as keyof typeof PROJECT_TYPES] || PROJECT_TYPES.personal;
  const swatch = [project.primaryColor, project.secondaryColor, project.accentColor];

  // Hover affordance lives entirely in ring + shadow — no transform, no scale.
  const cardBase =
    'group relative bg-[#111111] cursor-pointer ring-1 ring-white/5 hover:ring-[#0097A7]/40 ' +
    'shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-shadow duration-200';

  if (layout === 'list') {
    return (
      <div onClick={onClick} className={`${cardBase} flex items-center gap-5 rounded-2xl p-3.5`}>
        {/* Thumbnail */}
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#0a0a0a]">
          {project.coverImage ? (
            <img src={project.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0097A7]/[0.06] text-lg opacity-40">
              {projectType.icon}
            </div>
          )}
          <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-500">
            <span className="font-medium text-[#0097A7]/80">{projectType.label}</span>
            {project.subtype && (
              <>
                <span className="text-gray-700">·</span>
                <span>{project.subtype}</span>
              </>
            )}
          </div>
          <h3 className="truncate text-sm font-semibold text-white">{project.name}</h3>
          {project.clientName && (
            <p className="mt-0.5 truncate text-xs text-gray-500">{project.clientName}</p>
          )}
        </div>

        {/* Meta + actions */}
        <div className="flex shrink-0 items-center gap-6">
          <div className="hidden flex-col items-end gap-0.5 sm:flex">
            <span className="text-[10px] uppercase tracking-wide text-gray-600">Updated</span>
            <span className="text-xs tabular-nums text-gray-400">{formatDate(project.updatedAt)}</span>
          </div>

          <StatusControl status={project.status} onChange={onStatusChange} placement="top-right" />

          {!isShared && (
            <div className="flex items-center gap-2">
              <IconButton label="Edit project" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Settings className="h-4 w-4" />
              </IconButton>
              <IconButton label="Delete project" danger onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} className={`${cardBase} flex flex-col overflow-hidden rounded-2xl`}>
      {/* Thumbnail */}
      <div className="relative h-36 bg-[#0a0a0a]">
        {project.coverImage ? (
          <img
            src={project.coverImage}
            alt=""
            className="h-full w-full object-cover opacity-80 transition-opacity duration-200 group-hover:opacity-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0097A7]/10 to-transparent text-5xl opacity-25">
            {projectType.icon}
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />

        {/* Status + shared */}
        <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
          <StatusControl status={project.status} onChange={onStatusChange} placement="bottom-left" />
          {isShared && (
            <span className="inline-flex h-8 items-center gap-1.5 self-start rounded-full bg-[#0097A7]/15 px-3 ring-1 ring-[#0097A7]/25 backdrop-blur-md">
              <Users className="h-3 w-3 text-[#0097A7]" />
              <span className="text-[11px] font-medium text-[#0097A7]">Shared</span>
            </span>
          )}
        </div>

        {/* Actions — fade in on hover, no movement */}
        {!isShared && (
          <div className="absolute right-3 top-3 z-20 flex gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <IconButton label="Edit project" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Settings className="h-4 w-4" />
            </IconButton>
            <IconButton label="Delete project" danger onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-500">
          <span className="font-medium text-[#0097A7]/80">{projectType.label}</span>
          {project.subtype && (
            <>
              <span className="text-gray-700">·</span>
              <span>{project.subtype}</span>
            </>
          )}
        </div>

        <h3 className="truncate text-[15px] font-semibold leading-snug text-white">{project.name}</h3>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          {project.clientName && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{project.clientName}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="tabular-nums">{formatDate(project.updatedAt)}</span>
          </span>
        </div>

        <div className="pt-1">
          <Swatches colors={swatch} />
        </div>
      </div>
    </div>
  );
}
