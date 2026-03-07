import { DirectorySidebar } from './DirectorySidebar';
import { ImageGrid } from './ImageGrid';
import { MetadataPanel } from './MetadataPanel';

export function Layout() {
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
