import { useEffect, useState, useCallback, useRef } from 'react';
import { FolderOpen, Folder, Trash2, GripVertical } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { cn } from '../lib/cn';
import { t } from '../i18n';
import { UiButton } from './ui';

const REORDER_TYPE = 'application/x-directory-list-item';

export function DirectorySidebar() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggingDir, setDraggingDir] = useState<string | null>(null);
  const [dropTargetDir, setDropTargetDir] = useState<string | null>(null);
  const draggedDirRef = useRef<string | null>(null);
  const [editingDir, setEditingDir] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const directoryList = useAppStore((s) => s.directoryList);
  const currentDir = useAppStore((s) => s.currentDir);
  const addDirectory = useAppStore((s) => s.addDirectory);
  const removeDirectory = useAppStore((s) => s.removeDirectory);
  const setDirectoryListOrder = useAppStore((s) => s.setDirectoryListOrder);
  const replaceDirectoryPath = useAppStore((s) => s.replaceDirectoryPath);
  const setCurrentDir = useAppStore((s) => s.setCurrentDir);
  useAppStore((s) => s.locale);
  const resetOnDirChange = useAppStore((s) => s.resetOnDirChange);
  const clearImages = useAppStore((s) => s.clearImages);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);

  useEffect(() => {
    if (editingDir) {
      queueMicrotask(() => editInputRef.current?.focus());
    }
  }, [editingDir]);

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

  const handleStartRename = useCallback((dir: string) => {
    const base = dir.replace(/^.*[/\\]/, '') || dir;
    setEditingDir(dir);
    setEditName(base);
  }, []);

  const handleCancelRename = useCallback(() => {
    setEditingDir(null);
    setEditName('');
  }, []);

  const handleCommitRename = useCallback(async () => {
    if (!editingDir) return;
    const newName = editName.trim();
    if (!newName) {
      handleCancelRename();
      return;
    }
    if (!window.electronAPI?.renameDirectory) {
      handleCancelRename();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.renameDirectory(editingDir, newName);
      if (res.ok && res.newPath) {
        replaceDirectoryPath(editingDir, res.newPath);
        // 如果当前目录就是被改名的目录，触发刷新
        if (currentDir && currentDir.replace(/[/\\]+$/, '') === editingDir.replace(/[/\\]+$/, '')) {
          clearImages();
          setCurrentDir(null);
          queueMicrotask(() => setCurrentDir(res.newPath!));
        }
        setEditingDir(null);
        setEditName('');
      } else {
        setError(res.error ?? '重命名失败');
      }
    } finally {
      setLoading(false);
    }
  }, [
    editingDir,
    editName,
    replaceDirectoryPath,
    currentDir,
    clearImages,
    setCurrentDir,
    setLoading,
    setError,
    handleCancelRename,
  ]);

  const handleDragOver = (e: React.DragEvent) => {
    // 内部列表排序拖拽：不接管，让列表行自己成为 drop 目标
    if (e.dataTransfer.types.includes(REORDER_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false);
  };

  const handleRowDragStart = useCallback((e: React.DragEvent, dir: string) => {
    e.dataTransfer.setData(REORDER_TYPE, dir);
    e.dataTransfer.effectAllowed = 'move';
    draggedDirRef.current = dir;
    setDraggingDir(dir);
  }, []);

  const handleRowDragEnd = useCallback(() => {
    draggedDirRef.current = null;
    setDraggingDir(null);
    setDropTargetDir(null);
  }, []);

  const handleRowDragOver = useCallback((e: React.DragEvent, _dir: string) => {
    if (!e.dataTransfer.types.includes(REORDER_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetDir(_dir);
  }, []);

  const handleRowDragLeave = useCallback(() => {
    setDropTargetDir(null);
  }, []);

  const handleRowDrop = useCallback(
    (e: React.DragEvent, toDir: string) => {
      if (!e.dataTransfer.types.includes(REORDER_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTargetDir(null);
      setDraggingDir(null);
      const fromDir = draggedDirRef.current ?? e.dataTransfer.getData(REORDER_TYPE);
      draggedDirRef.current = null;
      if (!fromDir || fromDir === toDir) return;
      const list = [...directoryList];
      const fromIdx = list.indexOf(fromDir);
      const toIdx = list.indexOf(toDir);
      if (fromIdx === -1 || toIdx === -1) return;
      list.splice(fromIdx, 1);
      const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
      list.splice(insertIdx, 0, fromDir);
      setDirectoryListOrder(list);
    },
    [directoryList, setDirectoryListOrder]
  );

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.types.includes(REORDER_TYPE)) return;
    const files = e.dataTransfer.files;
    if (!files?.length || typeof window.electronAPI.getPathForDroppedFile !== 'function') return;
    // 在 contextIsolation 下必须通过 preload 的 webUtils.getPathForFile 获取路径
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const path = window.electronAPI.getPathForDroppedFile(files[i]);
      if (path) paths.push(path);
    }
    if (paths.length === 0) return;
    setLoading(true);
    setError(null);
    const added: string[] = [];
    for (const p of paths) {
      const dir = await window.electronAPI.addDirectoryByPath(p);
      if (dir) {
        addDirectory(dir);
        added.push(dir);
      }
    }
    if (added.length > 0) {
      clearImages();
      setCurrentDir(null);
      queueMicrotask(() => {
        setCurrentDir(added[0]);
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
        isDraggingOver && 'bg-emerald-900/30 ring-1 ring-emerald-500/50 ring-inset'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-700 p-3">
        <FolderOpen className="h-5 w-5 shrink-0 text-zinc-400" />
        <span
          className="min-w-0 text-sm font-medium text-zinc-300"
          title={isDraggingOver ? t('sidebar.dropHintFull') : undefined}
        >
          {isDraggingOver ? t('sidebar.dropHint') : t('sidebar.folders')}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <button
          type="button"
          onClick={handleOpenFolder}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-emerald-600/80 px-3 py-2 text-left text-sm font-medium text-white hover:bg-emerald-600"
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          {t('sidebar.openFolder')}
        </button>
        {directoryList.map((dir) => {
          const name = dir.replace(/^.*[/\\]/, '') || dir;
          const isActive = currentDir === dir;
          const isDragging = draggingDir === dir;
          const isDropTarget = dropTargetDir === dir;
          const isEditing = editingDir === dir;
          return (
            <div
              key={dir}
              role="button"
              tabIndex={0}
              draggable={!isEditing}
              onDragStart={(e) => handleRowDragStart(e, dir)}
              onDragEnd={handleRowDragEnd}
              onDragOver={(e) => handleRowDragOver(e, dir)}
              onDragLeave={handleRowDragLeave}
              onDrop={(e) => handleRowDrop(e, dir)}
              onClick={() => handleSelectDir(dir)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectDir(dir)}
              onDoubleClick={() => handleStartRename(dir)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm',
                isActive ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                isDragging && 'opacity-50',
                isDropTarget && 'ring-1 ring-emerald-500/60 ring-inset'
              )}
              title={dir}
            >
              <GripVertical
                className="h-4 w-4 shrink-0 cursor-grab text-zinc-500 active:cursor-grabbing"
                aria-hidden
              />
              <Folder className="h-4 w-4 shrink-0" />
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCommitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelRename();
                    }
                  }}
                  onBlur={handleCancelRename}
                  className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{name}</span>
              )}
              {!isEditing && (
                <UiButton
                  variant="ghost"
                  size="sm"
                  className="border-none p-0.5"
                  onClick={(e: React.MouseEvent) => handleRemove(e, dir)}
                  title={t('sidebar.remove')}
                >
                  <Trash2 className="h-4 w-4" />
                </UiButton>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
