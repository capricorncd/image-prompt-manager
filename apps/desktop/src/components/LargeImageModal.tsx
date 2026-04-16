import { useEffect } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  path: string | null;
  onClose: () => void;
  title?: string;
  /** 是否允许通过左右键切换并显示计数（列表大图用） */
  allowNavigation?: boolean;
  currentIndex?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export function LargeImageModal(props: Props): ReactNode | null {
  const { open, path, onClose, title, allowNavigation, currentIndex, total, onPrev, onNext } = props;

  useEffect(() => {
    if (!open || !path) return;
    const handler = (e: KeyboardEvent): void => {
      if (!allowNavigation) return;
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
  }, [open, allowNavigation, onPrev, onNext, onClose]);

  // 注意：必须在 hooks 之后再 return，避免条件性 hooks 导致监听器无法清理
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
            className="shrink-0 cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            aria-label={t('meta.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          <img
            src={`local://image?path=${encodeURIComponent(path)}`}
            alt=""
            className="max-h-[85vh] max-w-full object-contain"
          />
        </div>
      </div>
      {allowNavigation && total != null && currentIndex != null && total > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full bg-black/70 px-3 py-1 text-xs text-zinc-200">
            {currentIndex + 1}/{total}
          </div>
        </div>
      )}
    </div>
  );
}
