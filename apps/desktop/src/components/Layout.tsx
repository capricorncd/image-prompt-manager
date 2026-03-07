import { useEffect, useRef } from 'react';
import { DirectorySidebar } from './DirectorySidebar';
import { ImageGrid } from './ImageGrid';
import { MetadataPanel } from './MetadataPanel';
import { useAppStore, getPersistedDirectories } from '../stores/app-store';

export function Layout() {
  const directoryList = useAppStore((s) => s.directoryList);
  const restoreDirectories = useAppStore((s) => s.restoreDirectories);
  const hasRestored = useRef(false);

  useEffect(() => {
    if (hasRestored.current) return;
    if (directoryList.length > 0) return;
    const saved = getPersistedDirectories();
    if (!saved?.directoryList?.length || !window.electronAPI?.addDirectoryByPath) return;
    hasRestored.current = true;
    (async () => {
      const restored: string[] = [];
      for (const dir of saved.directoryList) {
        const resolved = await window.electronAPI.addDirectoryByPath(dir);
        if (resolved) restored.push(resolved);
      }
      if (restored.length === 0) return;
      const norm = (p: string) => p.replace(/[/\\]+$/, '');
      const preferredCurrent = saved.currentDir ? norm(saved.currentDir) : '';
      const match = restored.find((d) => norm(d) === preferredCurrent);
      const preferred = match ?? restored[0] ?? null;
      restoreDirectories(restored, preferred);
    })();
  }, [directoryList.length, restoreDirectories]);

  return (
    <div className="flex h-screen w-screen min-w-0 overflow-hidden bg-zinc-900 text-zinc-200">
      <DirectorySidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ImageGrid />
      </div>
      <MetadataPanel />
    </div>
  );
}
