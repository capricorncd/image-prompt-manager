import { FolderOpen, Folder, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { cn } from '../lib/cn';

export function DirectorySidebar() {
  const directoryList = useAppStore((s) => s.directoryList);
  const currentDir = useAppStore((s) => s.currentDir);
  const addDirectory = useAppStore((s) => s.addDirectory);
  const removeDirectory = useAppStore((s) => s.removeDirectory);
  const setCurrentDir = useAppStore((s) => s.setCurrentDir);
  const resetOnDirChange = useAppStore((s) => s.resetOnDirChange);
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

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-700 bg-zinc-900/80">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-700 p-3">
        <FolderOpen className="h-5 w-5 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-300">文件夹</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <button
          type="button"
          onClick={handleOpenFolder}
          className="flex w-full items-center gap-2 rounded-lg bg-emerald-600/80 px-3 py-2 text-left text-sm font-medium text-white hover:bg-emerald-600 cursor-pointer"
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          打开文件夹
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
                title="删除"
                aria-label="删除"
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
