import { useCallback, useEffect, useRef, useState } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { useAppStore } from '../stores/app-store';
import { PAGE_SIZE } from '../stores/app-store';
import { cn } from '../lib/cn';

const GAP = 8;
const MIN_CELL_SIZE = 100;
const CAPTION_HEIGHT = 24;
/** 预留垂直滚动条宽度，避免出现横向滚动条 */
const SCROLLBAR_WIDTH = 17;

interface CellProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
}

export function ImageGrid() {
  const currentDir = useAppStore((s) => s.currentDir);
  const imagePaths = useAppStore((s) => s.imagePaths);
  const hasMore = useAppStore((s) => s.hasMore);
  const loading = useAppStore((s) => s.loading);
  const selectedPath = useAppStore((s) => s.selectedPath);
  const appendImages = useAppStore((s) => s.appendImages);
  const setLoading = useAppStore((s) => s.setLoading);
  const selectImage = useAppStore((s) => s.selectImage);
  const setRawMetadata = useAppStore((s) => s.setRawMetadata);
  const gridRef = useRef<Grid>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });

  const loadPage = useCallback(
    async (offset: number) => {
      if (!currentDir || !window.electronAPI?.listImages) return;
      setLoading(true);
      try {
        const { entries, hasMore: more } = await window.electronAPI.listImages(
          currentDir,
          offset,
          PAGE_SIZE
        );
        appendImages(entries, more);
      } finally {
        setLoading(false);
      }
    },
    [currentDir, appendImages, setLoading]
  );

  useEffect(() => {
    if (!currentDir) return;
    loadPage(0);
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

  const loadMore = useCallback(() => {
    if (loading || !hasMore || imagePaths.length === 0) return;
    loadPage(imagePaths.length);
  }, [loading, hasMore, imagePaths.length, loadPage]);

  const handleSelect = useCallback(
    async (path: string) => {
      const meta = await window.electronAPI.readImageMetadata(path);
      selectImage(path, meta.parameters);
      setRawMetadata(meta.tags);
    },
    [selectImage, setRawMetadata]
  );

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
      const isSelected = selectedPath === path;
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
          <button
            type="button"
            onClick={() => handleSelect(path)}
            className={cn(
              'flex flex-1 flex-col overflow-hidden rounded-lg border-2 bg-zinc-800/80 transition-colors',
              isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-transparent hover:border-zinc-600'
            )}
          >
            <div className="flex aspect-square items-center justify-center overflow-hidden p-1">
              <img
                src={`local://image?path=${encodeURIComponent(path)}`}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
            <span className="truncate px-1 pb-1 text-center text-xs text-zinc-400" title={name}>
              {name}
            </span>
          </button>
        </div>
      );
    },
    [imagePaths, columnCount, selectedPath, handleSelect]
  );

  if (!currentDir) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-900 text-zinc-500">
        <p>请先打开一个文件夹</p>
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-900">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-700 px-3">
        <span className="text-sm text-zinc-400">
          共 {imagePaths.length} 张{hasMore ? '+' : ''}
        </span>
        {loading && <span className="text-xs text-zinc-500">加载中…</span>}
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
          onScroll={({ scrollTop }) => {
            const totalHeight = rowCount * rowHeight;
            if (totalHeight - scrollTop - gridHeight < 300) loadMore();
          }}
        >
          {Cell}
        </Grid>
      </div>
    </main>
  );
}
