import { useCallback, useEffect, useRef, useState } from 'react';
// TODO: 删除这个依赖，一次性全部加载，不分页
import { FixedSizeGrid as Grid } from 'react-window';
import { CheckSquare, Maximize2, RefreshCw, Square, X } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { cn } from '../lib/cn';
import { t } from '../i18n';
import { LargeImageModal } from './LargeImageModal';

const GAP = 8;
const MIN_CELL_SIZE = 100;
const CAPTION_HEIGHT = 24;

interface CellProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
}

export function ImageGrid() {
  const currentDir = useAppStore((s) => s.currentDir);
  const imagePaths = useAppStore((s) => s.imagePaths);
  const hasMore = useAppStore((s) => s.hasMore);
  const totalImageCount = useAppStore((s) => s.totalImageCount);
  const loading = useAppStore((s) => s.loading);
  const selectedPath = useAppStore((s) => s.selectedPath);
  const batchMode = useAppStore((s) => s.batchMode);
  const batchSelectedPaths = useAppStore((s) => s.batchSelectedPaths);
  const setImagePaths = useAppStore((s) => s.setImagePaths);
  const clearImages = useAppStore((s) => s.clearImages);
  const setLoading = useAppStore((s) => s.setLoading);
  const selectImage = useAppStore((s) => s.selectImage);
  const setBatchMode = useAppStore((s) => s.setBatchMode);
  const toggleBatchSelection = useAppStore((s) => s.toggleBatchSelection);
  const clearBatchSelection = useAppStore((s) => s.clearBatchSelection);
  const setRawMetadata = useAppStore((s) => s.setRawMetadata);
  const removeImagePath = useAppStore((s) => s.removeImagePath);
  const gridRef = useRef<Grid>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });
  const [pathToDelete, setPathToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [largeImageIndex, setLargeImageIndex] = useState<number>(0);
  const [showLargeImageModal, setShowLargeImageModal] = useState(false);

  const loadPage = useCallback(async () => {
    if (!currentDir || !window.electronAPI?.listImages) return;
    setLoading(true);
    try {
      const { entries, total } = await window.electronAPI.listImages(currentDir);
      setImagePaths(entries, total);
    } finally {
      setLoading(false);
    }
  }, [currentDir, setImagePaths, setLoading]);

  useEffect(() => {
    if (!currentDir) return;
    loadPage();
  }, [currentDir, loadPage]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = (): void => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setSize({ width: w, height: h });
    };
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    updateSize();
    return () => ro.disconnect();
  }, [currentDir]);

  const handleRefresh = useCallback(() => {
    if (!currentDir || loading) return;
    clearImages();
    loadPage();
  }, [currentDir, loading, clearImages, loadPage]);

  const isBatchSelected = useCallback(
    (path: string) => {
      const normalized = path.replace(/\\/g, '/');
      return batchSelectedPaths.some((p) => p.replace(/\\/g, '/') === normalized);
    },
    [batchSelectedPaths]
  );

  const handleSelect = useCallback(
    async (path: string) => {
      if (batchMode) {
        const currentlySelected = isBatchSelected(path);
        toggleBatchSelection(path);
        if (currentlySelected) {
          if (selectedPath && selectedPath.replace(/\\/g, '/') === path.replace(/\\/g, '/')) {
            const fallbackPath = batchSelectedPaths.find(
              (p) => p.replace(/\\/g, '/') !== path.replace(/\\/g, '/')
            );
            if (fallbackPath) {
              const fallbackMeta = await window.electronAPI.readImageMetadata(fallbackPath);
              selectImage(fallbackPath, fallbackMeta.parameters);
              setRawMetadata(fallbackMeta.tags);
            } else {
              selectImage(null, null);
              setRawMetadata({});
            }
          }
          return;
        }
      }
      const meta = await window.electronAPI.readImageMetadata(path);
      selectImage(path, meta.parameters);
      setRawMetadata(meta.tags);
    },
    [
      batchMode,
      isBatchSelected,
      toggleBatchSelection,
      batchSelectedPaths,
      selectedPath,
      selectImage,
      setRawMetadata,
    ]
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setPathToDelete(path);
  }, []);

  const handleViewLargeClick = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      const idx = imagePaths.indexOf(path);
      if (idx >= 0) setLargeImageIndex(idx);
      setShowLargeImageModal(true);
    },
    [imagePaths]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pathToDelete || !window.electronAPI?.deleteFile) return;
    setDeleting(true);
    try {
      const result = await window.electronAPI.deleteFile(pathToDelete);
      if (result.ok) {
        removeImagePath(pathToDelete);
        setPathToDelete(null);
      } else {
        window.alert(result.error ?? t('grid.deleteFailed'));
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t('grid.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }, [pathToDelete, removeImagePath]);

  const handleCancelDelete = useCallback(() => {
    if (!deleting) setPathToDelete(null);
  }, [deleting]);

  const handleToggleBatchMode = useCallback(() => {
    if (batchMode) {
      setBatchMode(false);
      clearBatchSelection();
      return;
    }
    setBatchMode(true);
  }, [batchMode, setBatchMode, clearBatchSelection]);

  const { width: gridWidth, height: gridHeight } = size;
  const widthForColumns = Math.max(MIN_CELL_SIZE, gridWidth - GAP);
  const columnCount = Math.max(1, Math.floor((widthForColumns + GAP) / (MIN_CELL_SIZE + GAP)));
  const columnWidth = widthForColumns / columnCount;
  const rowHeight = columnWidth + GAP + CAPTION_HEIGHT;
  const rowCount = Math.ceil(imagePaths.length / columnCount) || 1;

  const Cell = useCallback(
    ({ columnIndex, rowIndex, style }: CellProps) => {
      const index = rowIndex * columnCount + columnIndex;
      const path = imagePaths[index];
      if (!path) return <div style={style} />;
      const name = path.replace(/^.*[/\\]/, '');
      const isSelected = batchMode ? isBatchSelected(path) : selectedPath === path;
      return (
        <div
          style={{
            ...style,
            left: Number(style.left) + GAP,
            top: Number(style.top) + GAP,
            width: Number(style.width) - GAP,
            height: Number(style.height) - GAP,
          }}
          className="flex flex-col"
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleSelect(path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelect(path);
              }
            }}
            className={cn(
              'flex flex-1 cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-zinc-800/80 transition-colors',
              isSelected
                ? 'border-emerald-500 ring-1 ring-emerald-500/50'
                : 'border-transparent hover:border-zinc-600'
            )}
          >
            <div className="group relative flex aspect-square items-center justify-center overflow-hidden p-1">
              <img
                src={`local://image?path=${encodeURIComponent(path)}`}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
              />
              <button
                type="button"
                onClick={(e) => handleViewLargeClick(e, path)}
                className={cn(
                  'absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded bg-zinc-800/90 text-zinc-400',
                  'opacity-0 transition-opacity group-hover:opacity-100',
                  'hover:bg-zinc-700 hover:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none'
                )}
                title={t('meta.viewLarge')}
                aria-label={t('meta.viewLarge')}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (batchMode) {
                    void handleSelect(path);
                    return;
                  }
                  handleDeleteClick(e, path);
                }}
                className={cn(
                  'absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded bg-zinc-800/90 focus:ring-2 focus:outline-none',
                  batchMode
                    ? 'text-zinc-100 hover:bg-zinc-700 focus:ring-emerald-500'
                    : 'text-zinc-400 hover:bg-red-600/90 hover:text-white focus:ring-red-500'
                )}
                title={batchMode ? t('grid.batchSelect') : t('grid.deleteImage')}
                aria-label={batchMode ? t('grid.batchSelect') : t('sidebar.remove')}
              >
                {batchMode ? (
                  isSelected ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <span className="truncate px-1 pb-1 text-center text-xs text-zinc-400" title={name}>
              {name}
            </span>
          </div>
        </div>
      );
    },
    [
      imagePaths,
      columnCount,
      selectedPath,
      batchMode,
      isBatchSelected,
      handleSelect,
      handleDeleteClick,
      handleViewLargeClick,
    ]
  );

  if (!currentDir) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-900 text-zinc-500">
        <p>{t('grid.openFolderFirst')}</p>
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-900">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-700 px-3">
        <span className="text-sm text-zinc-400">
          {totalImageCount == null && hasMore
            ? t('grid.countMore', { n: imagePaths.length })
            : t('grid.count', { n: totalImageCount ?? imagePaths.length })}
        </span>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-zinc-500">{t('grid.loading')}</span>}
          <button
            type="button"
            onClick={handleToggleBatchMode}
            disabled={loading}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
              batchMode
                ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
                : 'text-zinc-400 hover:bg-zinc-700/80 hover:text-zinc-200',
              'disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-400'
            )}
            title={batchMode ? t('grid.batchCancel') : t('grid.batchSelect')}
          >
            {batchMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {batchMode ? t('grid.batchCancel') : t('grid.batchSelect')}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition-colors',
              'hover:bg-zinc-700/80 hover:text-zinc-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-400'
            )}
            title={t('grid.refreshTitle')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {t('grid.refresh')}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1">
        <Grid
          ref={gridRef}
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={rowHeight}
          height={gridHeight}
          width={widthForColumns}
          overscanRowCount={3}
          style={{ overflowX: 'hidden' }}
        >
          {Cell}
        </Grid>
      </div>

      <LargeImageModal
        open={showLargeImageModal}
        path={largeImageIndex != null ? imagePaths[largeImageIndex] : null}
        onClose={() => setShowLargeImageModal(false)}
        currentIndex={largeImageIndex != null ? largeImageIndex : undefined}
        total={totalImageCount ?? undefined}
        allowNavigation={true}
        onPrev={() => setLargeImageIndex((prev) => (prev <= 0 ? imagePaths.length - 1 : prev - 1))}
        onNext={() => setLargeImageIndex((prev) => (prev >= imagePaths.length - 1 ? 0 : prev + 1))}
      />

      {pathToDelete != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={handleCancelDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-confirm-title"
              className="border-b border-zinc-700 p-4 text-sm font-medium text-zinc-200"
            >
              {t('grid.deleteImage')}
            </h2>
            <section className="p-4">
              <p className="mt-2 text-sm text-zinc-400">{t('grid.deleteConfirm')}</p>
              <p className="mt-1 text-xs text-zinc-500" title={pathToDelete}>
                {pathToDelete.replace(/^.*[/\\]/, '')}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  disabled={deleting}
                  className="cursor-pointer rounded px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                >
                  {t('grid.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="cursor-pointer rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? t('grid.deleting') : t('grid.confirmDelete')}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
