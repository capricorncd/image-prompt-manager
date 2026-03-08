import { useState } from 'react';
import { FolderOpen, Folder, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { cn } from '../lib/cn';
import { t } from '../i18n';

export function DirectorySidebar() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const directoryList = useAppStore((s) => s.directoryList);
  const currentDir = useAppStore((s) => s.currentDir);
  const addDirectory = useAppStore((s) => s.addDirectory);
  const removeDirectory = useAppStore((s) => s.removeDirectory);
  const setCurrentDir = useAppStore((s) => s.setCurrentDir);
  useAppStore((s) => s.locale);
  const resetOnDirChange = useAppStore((s) => s.resetOnDirChange);
  const clearImages = useAppStore((s) => s.clearImages);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);

  const handleOpenFolder = async () => {
    const dir = await window.electronAPI.openDirectory();
    if (!dir) return;
    setLoading(true);
    setError(null);
    addDirectory(dir);
    setCurrentDir(dir);
    setLoading(false);
  };

  const handleSelectDir = (dir: string) => {
    if (currentDir === dir) return;
    setCurrentDir(dir);
    resetOnDirChange();
  };

  const handleRemove = async (e: React.MouseEvent, dir: string) => {
    e.stopPropagation();
    await window.electronAPI.removeDirectory(dir);
    removeDirectory(dir);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // 使用 copy 以允许放下；系统会显示「复制」，栏内用「松开以添加文件夹」表达真实含义
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    // 在 contextIsolation 下必须通过 preload 的 webUtils.getPathForFile 获取路径，File.path 已废弃且可能为空
    const droppedPath =
      file && typeof window.electronAPI.getPathForDroppedFile === 'function'
        ? window.electronAPI.getPathForDroppedFile(file)
        : '';
    if (!droppedPath) return;
    setLoading(true);
    setError(null);
    const dir = await window.electronAPI.addDirectoryByPath(droppedPath);
    if (dir) {
      clearImages();
      addDirectory(dir);
      // 先置空再设回，确保 ImageGrid 的 useEffect(currentDir) 会触发并执行 loadPage(0)
      setCurrentDir(null);
      queueMicrotask(() => {
        setCurrentDir(dir);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  };

  return (
    <aside
      className={cn(
        'flex w-60 shrink-0 flex-col border-r border-zinc-700 bg-zinc-900/80 transition-colors',
        isDraggingOver && 'bg-emerald-900/30 ring-1 ring-inset ring-emerald-500/50'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-700 p-3">
        <FolderOpen className="h-5 w-5 shrink-0 text-zinc-400" />
        <span className="min-w-0 text-sm font-medium text-zinc-300" title={isDraggingOver ? t('sidebar.dropHintFull') : undefined}>
          {isDraggingOver ? t('sidebar.dropHint') : t('sidebar.folders')}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <button
          type="button"
          onClick={handleOpenFolder}
          className="flex w-full items-center gap-2 rounded-lg bg-emerald-600/80 px-3 py-2 text-left text-sm font-medium text-white hover:bg-emerald-600 cursor-pointer"
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          {t('sidebar.openFolder')}
        </button>
        {directoryList.map((dir) => {
          const name = dir.replace(/^.*[/\\]/, '') || dir;
          const isActive = currentDir === dir;
          return (
            <div
              key={dir}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectDir(dir)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectDir(dir)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm',
                isActive
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              )}
              title={dir}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <button
                type="button"
                onClick={(e) => handleRemove(e, dir)}
                className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-600 hover:text-red-400 cursor-pointer"
                title={t('sidebar.remove')}
                aria-label={t('sidebar.remove')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
