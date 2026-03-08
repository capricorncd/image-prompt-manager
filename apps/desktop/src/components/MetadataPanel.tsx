import { useCallback, useEffect, useState } from 'react';
import { Save, Copy, X, ImageIcon } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import type { SDImageMetadata } from '../types/metadata';
import { cn } from '../lib/cn';
import { t } from '../i18n';

function emptyMeta(): SDImageMetadata {
  return {
    prompt: '',
    negativePrompt: '',
    steps: null,
    sampler: null,
    cfgScale: null,
    seed: null,
    size: null,
    modelHash: null,
    model: null,
    raw: '',
    userComment: '',
  };
}

function numOrNull(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function floatOrNull(s: string): number | null {
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function getBasename(filePath: string): string {
  return filePath.replace(/^.*[/\\]/, '') || filePath;
}

/** 文件名不含后缀，用于文件名框展示 */
function getBasenameWithoutExt(filePath: string): string {
  const base = getBasename(filePath);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export function MetadataPanel() {
  const selectedPath = useAppStore((s) => s.selectedPath);
  const editedMetadata = useAppStore((s) => s.editedMetadata);
  const rawMetadata = useAppStore((s) => s.rawMetadata);
  const setEditedMetadata = useAppStore((s) => s.setEditedMetadata);
  const setError = useAppStore((s) => s.setError);
  const replaceImagePath = useAppStore((s) => s.replaceImagePath);
  const selectImage = useAppStore((s) => s.selectImage);
  const setRawMetadata = useAppStore((s) => s.setRawMetadata);
  useAppStore((s) => s.locale);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editableFilename, setEditableFilename] = useState('');
  const [showRawModal, setShowRawModal] = useState(false);
  const [showLargeImageModal, setShowLargeImageModal] = useState(false);

  const meta = editedMetadata ?? emptyMeta();

  useEffect(() => {
    if (selectedPath) setEditableFilename(getBasenameWithoutExt(selectedPath));
  }, [selectedPath]);

  const update = useCallback(
    (patch: Partial<SDImageMetadata>) => {
      setEditedMetadata(meta ? { ...meta, ...patch } : null);
    },
    [meta, setEditedMetadata]
  );

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleSaveAs = useCallback(async () => {
    if (!selectedPath || !editedMetadata) {
      setToast(t('meta.selectImageFirst'));
      return;
    }
    setSaving(true);
    setError(null);
    setToast(t('meta.saveDialogOpening'));
    try {
      const api = window.electronAPI;
      if (!api?.showSaveDialogWithSuggestedName) {
        setToast(t('meta.saveAsUnsupported'));
        setSaving(false);
        return;
      }
      const nameNoExt = editableFilename.trim() || getBasenameWithoutExt(selectedPath);
      const target = await api.showSaveDialogWithSuggestedName(selectedPath, nameNoExt);
      setToast('');
      if (!target) {
        setToast(t('meta.cancelled'));
        setSaving(false);
        return;
      }
      const result = await api.saveImageWithMetadata(selectedPath, target, editedMetadata);
      if (result.ok) {
        // TODO: 自动刷新列表？
        // replaceImagePath(selectedPath, target);
        // const fresh = await window.electronAPI.readImageMetadata(target);
        // selectImage(target, fresh ? fresh.parameters : null);
        // setRawMetadata(fresh?.tags ?? {});
        setToast(t('meta.savedAs'));
      } else {
        setError(result.error ?? t('meta.saveFailed'));
        setToast(result.error ?? t('meta.saveFailed'));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setToast(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedPath, editedMetadata, editableFilename, setError, replaceImagePath]);

  const handleOverwrite = useCallback(async () => {
    if (!selectedPath || !editedMetadata) return;
    setSaving(true);
    setError(null);
    const currentBaseNoExt = getBasenameWithoutExt(selectedPath);
    const nameNoExt = editableFilename.trim() || currentBaseNoExt;
    const filenameChanged = nameNoExt !== currentBaseNoExt;

    try {
      if (filenameChanged) {
        const newPath = await window.electronAPI.buildSavePath(selectedPath, nameNoExt);
        if (!newPath) {
          setError(t('meta.cannotBuildPath'));
        } else if (newPath === selectedPath) {
          const result = await window.electronAPI.writeImageMetadata(selectedPath, editedMetadata);
          if (result.ok) {
            setToast(t('meta.saved'));
            selectImage(selectedPath, result.meta?.parameters ?? null);
            setRawMetadata(result.meta?.tags ?? {});
          } else {
        setError(result.error ?? t('meta.saveFailed'));
        setToast(result.error ?? t('meta.saveFailed'));
          }
        } else {
          const saveResult = await window.electronAPI.saveImageWithMetadata(selectedPath, newPath, editedMetadata);
          if (!saveResult.ok) {
            setError(saveResult.error ?? t('meta.saveFailed'));
            setToast(saveResult.error ?? t('meta.saveFailed'));
          } else {
            replaceImagePath(selectedPath, newPath);
            setToast(t('meta.saved'));
            const fresh = await window.electronAPI.readImageMetadata(newPath);
            selectImage(newPath, fresh ? fresh.parameters : null);
            setRawMetadata(fresh?.tags ?? {});
            const delResult = await window.electronAPI.deleteFile(selectedPath);
            if (!delResult.ok) {
              setError(delResult.error ?? t('meta.originalDeleteFailed'));
              setToast(t('meta.savedButOriginalDeleteFailed'));
            }
          }
        }
      } else {
        const result = await window.electronAPI.writeImageMetadata(selectedPath, editedMetadata);
        if (result.ok) {
          setToast(t('meta.saved'));
          selectImage(selectedPath, result.meta?.parameters ?? null);
          setRawMetadata(result.meta?.tags ?? {});
        } else {
        setError(result.error ?? t('meta.saveFailed'));
        setToast(result.error ?? t('meta.saveFailed'));
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setToast(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedPath, editedMetadata, editableFilename, setError, replaceImagePath, selectImage]);

  if (!selectedPath) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-700 bg-zinc-900/80">
        <div className="flex items-center gap-2 border-b border-zinc-700 p-3 h-12">
          <span className="text-sm font-medium text-zinc-400">{t('meta.title')}</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-zinc-500">
          {t('meta.selectFirst')}
        </div>
      </aside>
    );
  }

  const label = 'block text-xs font-medium text-zinc-500 mb-1';

  const input =
    'w-full rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';

  return (
    <aside className="relative flex w-80 shrink-0 flex-col border-l border-zinc-700 bg-zinc-900/80">
      <div className="flex h-12 shrink-0 w-full items-center justify-between border-b border-zinc-700 p-3">
        <span className="text-sm font-medium text-zinc-400">{t('meta.imageInfo')}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLargeImageModal(true)}
            className="shrink-0 flex items-center gap-1.5 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 cursor-pointer"
            title={t('meta.viewLarge')}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {t('meta.viewLarge')}
          </button>
          <button
            type="button"
            onClick={() => setShowRawModal(true)}
            className="shrink-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 cursor-pointer"
            title={t('meta.rawInfo')}
          >
            {t('meta.rawInfo')}
          </button>
        </div>
      </div>
      {showLargeImageModal && selectedPath && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowLargeImageModal(false)}
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
                {getBasename(selectedPath)}
              </h2>
              <button
                type="button"
                onClick={() => setShowLargeImageModal(false)}
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 cursor-pointer"
                aria-label={t('meta.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4 flex items-center justify-center">
              <img
                src={`local://image?path=${encodeURIComponent(selectedPath)}`}
                alt=""
                className="max-h-[85vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
      {showRawModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowRawModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="raw-modal-title"
        >
          <div
            className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-4 py-3">
              <h2 id="raw-modal-title" className="text-sm font-medium text-zinc-200">
                {t('meta.rawInfo')}
              </h2>
              <button
                type="button"
                onClick={() => setShowRawModal(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 cursor-pointer"
                aria-label={t('meta.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
              <section className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
               {JSON.stringify(rawMetadata, null, 2)}
               </section>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">{t('meta.filename')}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className={cn(input, 'min-w-0 flex-1')}
              value={editableFilename}
              onChange={(e) => setEditableFilename(e.target.value)}
              placeholder={t('meta.filenamePlaceholder')}
              title={selectedPath}
            />
          </div>
          <div className='text-xs text-zinc-500 flex pt-2 justify-between'>
            <span>{String(rawMetadata.ImageWidth ?? '')} x {String(rawMetadata.ImageHeight ?? '')} px</span>
            <span>{String(rawMetadata.FileSize ?? '')}</span>
          </div>
        </div>
        <div>
          <label className={label}>{t('meta.userComment')}</label>
          <textarea
            className={cn(input, 'min-h-[200px] resize-y')}
            value={meta.userComment}
            onChange={(e) => update({ userComment: e.target.value })}
            placeholder="User Comment"
            rows={3}
          />
        </div>
        <div>
          <label className={label}>{t('meta.prompt')}</label>
          <textarea
            className={cn(input, 'min-h-[80px] resize-y')}
            value={meta.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder="Prompt"
            rows={3}
          />
        </div>
        <div>
          <label className={label}>{t('meta.negativePrompt')}</label>
          <textarea
            className={cn(input, 'min-h-[60px] resize-y')}
            value={meta.negativePrompt}
            onChange={(e) => update({ negativePrompt: e.target.value })}
            placeholder="Negative prompt"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>{t('meta.steps')}</label>
            <input
              type="number"
              className={input}
              value={meta.steps ?? ''}
              onChange={(e) => update({ steps: numOrNull(e.target.value) })}
              placeholder="20"
              min={1}
            />
          </div>
          <div>
            <label className={label}>{t('meta.cfg')}</label>
            <input
              type="number"
              step="0.5"
              className={input}
              value={meta.cfgScale ?? ''}
              onChange={(e) => update({ cfgScale: floatOrNull(e.target.value) })}
              placeholder="7"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>{t('meta.seed')}</label>
            <input
              type="number"
              className={input}
              value={meta.seed ?? ''}
              onChange={(e) => update({ seed: numOrNull(e.target.value) })}
              placeholder="-"
            />
          </div>
          <div>
            <label className={label}>{t('meta.sampler')}</label>
            <input
              type="text"
              className={input}
              value={meta.sampler ?? ''}
              onChange={(e) => update({ sampler: e.target.value || null })}
              placeholder="Euler a"
            />
          </div>
        </div>
        <div>
          <label className={label}>{t('meta.size')}</label>
          <input
            type="text"
            className={input}
            value={meta.size ?? ''}
            onChange={(e) => update({ size: e.target.value || null })}
            placeholder="512x512"
          />
        </div>
        <div>
          <label className={label}>{t('meta.model')}</label>
          <input
            type="text"
            className={input}
            value={meta.model ?? ''}
            onChange={(e) => update({ model: e.target.value || null })}
            placeholder=""
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-zinc-700 p-3">
        <button
          type="button"
          onClick={handleOverwrite}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          {t('meta.save')}
        </button>
        <button
          type="button"
          onClick={handleSaveAs}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 cursor-pointer"
        >
          <Copy className="h-4 w-4" />
          {t('meta.saveAs')}
        </button>
      </div>
      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-zinc-700 px-4 py-2 text-sm text-zinc-200 shadow-lg">
          {toast}
        </div>
      )}
    </aside>
  );
}
