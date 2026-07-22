import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Image as ImageIcon, Video as VideoIcon, Music as AudioIcon, FileText as DocIcon,
  Search, Filter, Play, FlaskConical,
} from 'lucide-react';
import { assetsApi, projectsApi, Asset } from '../../lib/api';
import type { LibraryFilters } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { PLAYGROUND_PROJECT_ID } from '../../constants';

export type LibraryAsset = Asset & { project_name?: string };

interface LibraryGridProps {
  isPicker?: boolean;
  onSelect?: (asset: LibraryAsset) => void;
  initialFilters?: LibraryFilters;
  /** Render prop for per-card actions (used by move-to-project) */
  renderCardActions?: (asset: LibraryAsset, refresh: () => void) => React.ReactNode;
}

const TYPE_FILTERS = ['all', 'image', 'video', 'audio'] as const;
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;

function typeIcon(type: string) {
  switch (type) {
    case 'image': return ImageIcon;
    case 'video': return VideoIcon;
    case 'audio': return AudioIcon;
    default: return DocIcon;
  }
}

interface LibraryAssetCardProps {
  asset: LibraryAsset;
  index: number;
  visibleMediaIndex: number;
  handleClick: (asset: LibraryAsset) => void;
  renderCardActions?: (asset: LibraryAsset, refresh: () => void) => React.ReactNode;
  refresh: () => void;
  onMediaLoaded: (index: number) => void;
}

function LibraryAssetCard({
  asset,
  index,
  visibleMediaIndex,
  handleClick,
  renderCardActions,
  refresh,
  onMediaLoaded,
}: LibraryAssetCardProps) {
  const Icon = typeIcon(asset.type);
  const isPlaygroundAsset = asset.project_id === PLAYGROUND_PROJECT_ID;
  const shouldLoad = index <= visibleMediaIndex;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [asset.url]);

  useEffect(() => {
    if (shouldLoad && asset.type !== 'image' && asset.type !== 'video') {
      onMediaLoaded(index);
    }
  }, [shouldLoad, asset.type, index, onMediaLoaded]);

  if (!shouldLoad) {
    return (
      <div className="group relative aspect-square overflow-hidden rounded-xl bg-[#111111] ring-1 ring-white/10">
        <div className="flex h-full w-full animate-pulse items-center justify-center bg-[#151515]">
          <Icon className="h-6 w-6 text-gray-800" />
        </div>
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
          {isPlaygroundAsset && <FlaskConical className="h-2.5 w-2.5 text-[#0097A7]" />}
          <span className={`max-w-[110px] truncate text-[10px] font-medium ${isPlaygroundAsset ? 'text-[#0097A7]' : 'text-gray-300'}`}>
            {isPlaygroundAsset ? 'Playground' : asset.project_name || 'Unknown project'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => handleClick(asset)}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-[#111111] ring-1 ring-white/10 transition-[transform,box-shadow] duration-150 hover:ring-[#0097A7]/40 active:scale-[0.98]"
    >
      {asset.type === 'video' ? (
        <div className="relative h-full w-full bg-[#111111]">
          <video
            src={asset.url + '#t=0.1'}
            className="h-full w-full object-cover opacity-70 group-hover:opacity-100"
            preload="metadata"
            onLoadedData={() => {
              setLoaded(true);
              onMediaLoaded(index);
            }}
            onError={() => {
              setLoaded(true);
              onMediaLoaded(index);
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 ring-1 ring-white/20 backdrop-blur-md transition-colors duration-150 group-hover:bg-[#0097A7]/50">
              <Play className="h-3 w-3 fill-white text-white" />
            </div>
          </div>
        </div>
      ) : asset.type === 'image' ? (
        <div className="relative h-full w-full bg-[#111111]">
          <img
            src={asset.url}
            alt={asset.filename}
            className="h-full w-full object-cover opacity-80 group-hover:opacity-100"
            loading="lazy"
            onLoad={() => {
              setLoaded(true);
              onMediaLoaded(index);
            }}
            onError={() => {
              setLoaded(true);
              onMediaLoaded(index);
            }}
          />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Icon className="h-8 w-8 text-gray-700 transition-colors group-hover:text-[#0097A7]" />
        </div>
      )}

      <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />

      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
        {isPlaygroundAsset && <FlaskConical className="h-2.5 w-2.5 text-[#0097A7]" />}
        <span className={`max-w-[110px] truncate text-[10px] font-medium ${isPlaygroundAsset ? 'text-[#0097A7]' : 'text-gray-300'}`}>
          {isPlaygroundAsset ? 'Playground' : asset.project_name || 'Unknown project'}
        </span>
      </div>

      {/* Grid overlay shown on hover */}
      {(!loaded || asset.type !== 'image' && asset.type !== 'video' ? true : loaded) && (
        <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-transparent p-2.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <div className="flex justify-end gap-1.5">
            {renderCardActions?.(asset, refresh)}
          </div>
          <div className="space-y-0.5">
            <p className="truncate text-[12px] font-medium text-white">{asset.filename}</p>
            <span className="text-[11px] capitalize text-gray-400">{asset.type}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Global asset library: everything generated/uploaded across all projects
 * (playground included), filterable by type/project with server-side search.
 * Standalone from AssetGrid, which is welded to the current project.
 */
export default function LibraryGrid({ isPicker = false, onSelect, initialFilters, renderCardActions }: LibraryGridProps) {
  const setExpandedAsset = useStore((s) => s.setExpandedAsset);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>(initialFilters?.type ?? 'all');
  const [projectFilter, setProjectFilter] = useState<string>(initialFilters?.projectId ?? '');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [projectOptions, setProjectOptions] = useState<{ id: string; name: string }[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const [visibleMediaIndex, setVisibleMediaIndex] = useState(0);

  const nextBatchRef = useRef<LibraryAsset[] | null>(null);
  const isLastBatchRef = useRef(false);
  const isPrefetchingRef = useRef(false);
  const loadMoreRequestedRef = useRef(false);
  const currentOffsetRef = useRef(0);
  const filterRef = useRef({ typeFilter, projectFilter, search });

  useEffect(() => {
    filterRef.current = { typeFilter, projectFilter, search };
  }, [typeFilter, projectFilter, search]);

  const refresh = useMemo(() => () => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    projectsApi.list()
      .then((list) => setProjectOptions(list.map((p) => ({ id: p.id, name: p.name }))))
      .catch((err) => console.error('Failed to load projects for library filter:', err));
  }, []);

  // Reset index to 0 ONLY on actual search/filter/refresh actions
  useEffect(() => {
    setVisibleMediaIndex(0);
  }, [typeFilter, projectFilter, search, refreshTick]);

  const handleMediaLoaded = useCallback((index: number) => {
    setVisibleMediaIndex((prev) => {
      if (index === prev) {
        return prev + 1;
      }
      return prev;
    });
  }, []);

  // Safety self-healing timeout to guarantee sequential loading never blocks (3.5s)
  useEffect(() => {
    if (visibleMediaIndex >= assets.length) return;
    const timer = setTimeout(() => {
      setVisibleMediaIndex((prev) => {
        if (prev < assets.length) {
          return prev + 1;
        }
        return prev;
      });
    }, 3500);
    return () => clearTimeout(timer);
  }, [visibleMediaIndex, assets.length]);

  const prefetchNextBatchRef = useRef<(offset: number) => void>(() => {});

  const appendBatch = useCallback((batch: LibraryAsset[]) => {
    setAssets((prev) => [...prev, ...batch]);
    currentOffsetRef.current += batch.length;

    if (isLastBatchRef.current || batch.length < PAGE_SIZE) {
      setHasMore(false);
    } else {
      setHasMore(true);
      prefetchNextBatchRef.current(currentOffsetRef.current);
    }
  }, []);

  const prefetchNextBatch = useCallback(async (offset: number) => {
    if (isPrefetchingRef.current) return;
    const { typeFilter: type, projectFilter: projectId, search: q } = filterRef.current;

    isPrefetchingRef.current = true;
    try {
      const batch = await assetsApi.listAll({
        type: type === 'all' ? undefined : type,
        projectId: projectId || undefined,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      isPrefetchingRef.current = false;
      nextBatchRef.current = batch;

      if (batch.length < PAGE_SIZE) {
        isLastBatchRef.current = true;
      }

      if (loadMoreRequestedRef.current) {
        loadMoreRequestedRef.current = false;
        setLoadingMore(false);
        appendBatch(batch);
      }
    } catch (err) {
      console.error('Failed to prefetch library assets:', err);
      isPrefetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [appendBatch]);

  useEffect(() => {
    prefetchNextBatchRef.current = prefetchNextBatch;
  }, [prefetchNextBatch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadingMore(false);
    setHasMore(false);
    setAssets([]);
    nextBatchRef.current = null;
    isLastBatchRef.current = false;
    isPrefetchingRef.current = false;
    loadMoreRequestedRef.current = false;
    currentOffsetRef.current = 0;

    assetsApi.listAll({
      type: typeFilter === 'all' ? undefined : typeFilter,
      projectId: projectFilter || undefined,
      q: search || undefined,
      limit: PAGE_SIZE,
      offset: 0,
    })
      .then((batch1) => {
        if (cancelled) return;
        setAssets(batch1);
        setLoading(false);
        currentOffsetRef.current = batch1.length;

        if (batch1.length < PAGE_SIZE) {
          setHasMore(false);
        } else {
          setHasMore(true);
          prefetchNextBatch(PAGE_SIZE);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load library:', err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [typeFilter, projectFilter, search, refreshTick, prefetchNextBatch]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;

    if (nextBatchRef.current !== null) {
      const batch = nextBatchRef.current;
      nextBatchRef.current = null;
      appendBatch(batch);
    } else {
      setLoadingMore(true);
      loadMoreRequestedRef.current = true;
    }
  }, [hasMore, loading, loadingMore, appendBatch]);

  const handleClick = (asset: LibraryAsset) => {
    if (isPicker && onSelect) {
      onSelect(asset);
      return;
    }
    if (asset.type === 'image' || asset.type === 'video' || asset.type === 'audio') {
      setExpandedAsset(asset.url, asset.type);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by filename or prompt"
            className="w-full rounded-lg bg-white/[0.04] py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-gray-600 ring-1 ring-white/10 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60"
          />
        </div>

        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ring-1 transition-[transform,color,background-color,box-shadow] duration-150 active:scale-[0.96] ${
                typeFilter === f ? 'bg-[#0097A7] text-white ring-[#0097A7]' : 'bg-white/[0.03] text-gray-400 ring-white/10 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="cursor-pointer rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-gray-300 ring-1 ring-white/10 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60"
        >
          <option value="">All projects</option>
          <option value={PLAYGROUND_PROJECT_ID}>Playground</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="custom-scrollbar flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#0097A7]/20 border-t-[#0097A7]" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
              <Filter className="h-5 w-5 text-gray-600" />
            </div>
            <p className="text-xs text-gray-500">Nothing here yet — everything you generate shows up in the library.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {assets.map((asset, i) => (
                <LibraryAssetCard
                  key={asset.id}
                  asset={asset}
                  index={i}
                  visibleMediaIndex={visibleMediaIndex}
                  handleClick={handleClick}
                  renderCardActions={renderCardActions}
                  refresh={refresh}
                  onMediaLoaded={handleMediaLoaded}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-4 flex justify-center pb-2">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,background-color,color] duration-150 hover:bg-white/[0.08] hover:text-white active:scale-[0.96] disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0097A7]/20 border-t-[#0097A7]" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}