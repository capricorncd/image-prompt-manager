import { X } from 'lucide-react';
import { t } from '../i18n';
import type { JSX } from 'react';

export function LargeImageModal(props: {
  open: boolean;
  path: string | null;
  onClose: () => void;
  title?: string;
}): JSX.Element | null {
  const { open, path, onClose, title } = props;
  if (!open || !path) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="large-image-title"
    >
      <div
        className="flex max-h-[98vh] max-w-[96vw] flex-col rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-4 py-2">
          <h2 id="large-image-title" className="truncate text-sm font-medium text-zinc-200">
            {title ?? path.replace(/^.*[/\\]/, '')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 cursor-pointer"
            aria-label={t('meta.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 flex items-center justify-center">
          <img
            src={`local://image?path=${encodeURIComponent(path)}`}
            alt=""
            className="max-h-[85vh] max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

