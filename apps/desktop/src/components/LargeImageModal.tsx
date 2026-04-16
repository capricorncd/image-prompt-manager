import { useEffect } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';
import type { JSX } from 'react';

export function LargeImageModal(props: {
  open: boolean;
  path: string | null;
  onClose: () => void;
  title?: string;
  currentIndex?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
}): JSX.Element | null {
  const { open, path, onClose, title, currentIndex, total, onPrev, onNext } = props;
  if (!open || !path) return null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') {
        if (onPrev) {
          e.preventDefault();
          onPrev();
        }
      } else if (e.key === 'ArrowRight') {
        if (onNext) {
          e.preventDefault();
          onNext();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onPrev, onNext, onClose]);

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
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 id="large-image-title" className="truncate text-sm font-medium text-zinc-200">
              {title ?? path.replace(/^.*[/\\]/, '')}
            </h2>
            {total != null && currentIndex != null && total > 0 && (
              <span className="mt-0.5 text-[11px] text-zinc-500">
                {currentIndex + 1}/{total}
              </span>
            )}
          </div>
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

