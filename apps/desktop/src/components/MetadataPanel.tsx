import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Copy, X, ImageIcon, CheckSquare, Square } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import type { SDImageMetadata } from '../types/metadata';
import { cn } from '../lib/cn';
import { t } from '../i18n';
import { LargeImageModal } from './LargeImageModal';

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

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/** 文件名不含后缀，用于文件名框展示 */
function getBasenameWithoutExt(filePath: string): string {
  const base = getBasename(filePath);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function getExt(filePath: string): string {
  const base = getBasename(filePath);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot) : '.png';
}

function buildBatchNameNoExt(sourcePath: string, index: number, renameEnabled: boolean, prefix: string): string {
  const rawBase = renameEnabled ? prefix.trim() || getBasenameWithoutExt(sourcePath) : getBasenameWithoutExt(sourcePath);
  const suffix = `[_${String(index + 1).padStart(3, '0')}]`;
  return `${rawBase}${suffix}`;
}

function buildPathInDirectory(dirPath: string, fileName: string): string {
  const sep = dirPath.includes('\\') ? '\\' : '/';
  const cleanDir = dirPath.replace(/[\\/]+$/, '');
  return `${cleanDir}${sep}${fileName}`;
}

export function MetadataPanel() {
  const imagePaths = useAppStore((s) => s.imagePaths);
  const selectedPath = useAppStore((s) => s.selectedPath);
  const batchMode = useAppStore((s) => s.batchMode);
  const batchSelectedPaths = useAppStore((s) => s.batchSelectedPaths);
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
  const [batchRenameEnabled, setBatchRenameEnabled] = useState(false);
  const [batchFilenamePrefix, setBatchFilenamePrefix] = useState('');
  const [showRawModal, setShowRawModal] = useState(false);
  const [showLargeImageModal, setShowLargeImageModal] = useState(false);

  const meta = editedMetadata ?? emptyMeta();
  const orderedBatchSelectedPaths = useMemo(() => {
    if (batchSelectedPaths.length === 0) return [];
    const selectedSet = new Set(batchSelectedPaths.map((p) => normalizePath(p)));
    return imagePaths.filter((p) => selectedSet.has(normalizePath(p)));
  }, [imagePaths, batchSelectedPaths]);

  useEffect(() => {
    if (selectedPath && !batchMode) setEditableFilename(getBasenameWithoutExt(selectedPath));
  }, [selectedPath, batchMode]);

  useEffect(() => {
    if (!batchMode) {
      setBatchRenameEnabled(false);
      setBatchFilenamePrefix('');
    }
  }, [batchMode]);

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
    const metadataToWrite = editedMetadata ?? emptyMeta();
    if (batchMode) {
      if (orderedBatchSelectedPaths.length === 0) {
        setToast(t('meta.selectBatchFirst'));
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const api = window.electronAPI;
        if (!api?.chooseOutputDirectory) {
          setToast(t('meta.saveAsUnsupported'));
          return;
        }
        const targetDir = await api.chooseOutputDirectory();
        if (!targetDir) {
          setToast(t('meta.cancelled'));
          return;
        }
        let successCount = 0;
        let failedCount = 0;
        for (let i = 0; i < orderedBatchSelectedPaths.length; i += 1) {
          const sourcePath = orderedBatchSelectedPaths[i]!;
          const nameNoExt = buildBatchNameNoExt(sourcePath, i, batchRenameEnabled, batchFilenamePrefix);
          const targetPath = buildPathInDirectory(targetDir, `${nameNoExt}${getExt(sourcePath)}`);
          const result = await api.saveImageWithMetadata(sourcePath, targetPath, metadataToWrite);
          if (result.ok) {
            successCount += 1;
          } else {
            failedCount += 1;
          }
        }
        setToast(
          `${t('meta.batchSaveAsDone', { n: successCount })}${
            failedCount > 0 ? t('meta.batchPartialFailed', { n: failedCount }) : ''
          }`
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setToast(msg);
      } finally {
        setSaving(false);
      }
      return;
    }

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
  }, [
    selectedPath,
    editedMetadata,
    editableFilename,
    setError,
    batchMode,
    orderedBatchSelectedPaths,
    batchRenameEnabled,
    batchFilenamePrefix,
  ]);

  const handleOverwrite = useCallback(async () => {
    const metadataToWrite = editedMetadata ?? emptyMeta();
    if (batchMode) {
      if (orderedBatchSelectedPaths.length === 0) {
        setToast(t('meta.selectBatchFirst'));
        return;
      }
      setSaving(true);
      setError(null);
      let successCount = 0;
      let failedCount = 0;
      const updatedPaths: string[] = [];
      try {
        for (let i = 0; i < orderedBatchSelectedPaths.length; i += 1) {
          const sourcePath = orderedBatchSelectedPaths[i]!;
          let targetPath = sourcePath;
          if (batchRenameEnabled) {
            const targetNameNoExt = buildBatchNameNoExt(
              sourcePath,
              i,
              batchRenameEnabled,
              batchFilenamePrefix
            );
            targetPath = await window.electronAPI.buildSavePath(sourcePath, targetNameNoExt);
            if (!targetPath) {
              failedCount += 1;
              continue;
            }
          }

          const samePath = normalizePath(targetPath) === normalizePath(sourcePath);
          if (samePath) {
            const result = await window.electronAPI.writeImageMetadata(sourcePath, metadataToWrite);
            if (result.ok) {
              successCount += 1;
              updatedPaths.push(sourcePath);
            } else {
              failedCount += 1;
            }
            continue;
          }

          const saveResult = await window.electronAPI.saveImageWithMetadata(
            sourcePath,
            targetPath,
            metadataToWrite
          );
          if (!saveResult.ok) {
            failedCount += 1;
            continue;
          }
          replaceImagePath(sourcePath, targetPath);
          updatedPaths.push(targetPath);
          successCount += 1;
          const delResult = await window.electronAPI.deleteFile(sourcePath);
          if (!delResult.ok) {
            setError(delResult.error ?? t('meta.originalDeleteFailed'));
          }
        }

        const firstPath = updatedPaths[0];
        if (firstPath) {
          const fresh = await window.electronAPI.readImageMetadata(firstPath);
          selectImage(firstPath, fresh ? fresh.parameters : null);
          setRawMetadata(fresh?.tags ?? {});
        }
        setToast(
          `${t('meta.batchSaveDone', { n: successCount })}${
            failedCount > 0 ? t('meta.batchPartialFailed', { n: failedCount }) : ''
          }`
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setToast(msg);
      } finally {
        setSaving(false);
      }
      return;
    }

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
          const saveResult = await window.electronAPI.saveImageWithMetadata(
            selectedPath,
            newPath,
            editedMetadata
          );
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
  }, [
    selectedPath,
    editedMetadata,
    editableFilename,
    setError,
    replaceImagePath,
    selectImage,
    batchMode,
    orderedBatchSelectedPaths,
    batchRenameEnabled,
    batchFilenamePrefix,
  ]);

  if (!selectedPath && !batchMode) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-700 bg-zinc-900/80">
        <div className="flex h-12 items-center gap-2 border-b border-zinc-700 p-3">
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
      <div className="flex h-12 w-full shrink-0 items-center justify-between border-b border-zinc-700 p-3">
        <span className="text-sm font-medium text-zinc-400">
          {t('meta.imageInfo')}
          {batchMode ? ` (${orderedBatchSelectedPaths.length})` : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLargeImageModal(true)}
            disabled={batchMode || !selectedPath}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs',
              batchMode || !selectedPath
                ? 'cursor-not-allowed text-zinc-600 opacity-70'
                : 'cursor-pointer text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            )}
            title={t('meta.viewLarge')}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {t('meta.viewLarge')}
          </button>
          <button
            type="button"
            onClick={() => setShowRawModal(true)}
            disabled={batchMode || !selectedPath}
            className={cn(
              'shrink-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs',
              batchMode || !selectedPath
                ? 'cursor-not-allowed text-zinc-600 opacity-70'
                : 'cursor-pointer text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            )}
            title={t('meta.rawInfo')}
          >
            {t('meta.rawInfo')}
          </button>
        </div>
      </div>
      <LargeImageModal
        open={showLargeImageModal}
        path={selectedPath}
        onClose={() => setShowLargeImageModal(false)}
        title={selectedPath ? getBasename(selectedPath) : undefined}
      />
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
                className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                aria-label={t('meta.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <section className="font-mono text-xs whitespace-pre-wrap text-zinc-300">
                {JSON.stringify(rawMetadata, null, 2)}
              </section>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">{t('meta.filename')}</label>
          {batchMode ? (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={batchRenameEnabled}
                  onChange={(e) => setBatchRenameEnabled(e.target.checked)}
                />
                {batchRenameEnabled ? (
                  <CheckSquare className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Square className="h-4 w-4 text-zinc-500" />
                )}
                <span>{t('meta.batchNaming')}</span>
              </label>
              <input
                type="text"
                className={cn(input, 'min-w-0 flex-1', !batchRenameEnabled && 'cursor-not-allowed opacity-50')}
                value={batchFilenamePrefix}
                onChange={(e) => setBatchFilenamePrefix(e.target.value)}
                placeholder={t('meta.batchFilenamePrefix')}
                disabled={!batchRenameEnabled}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                className={cn(input, 'min-w-0 flex-1')}
                value={editableFilename}
                onChange={(e) => setEditableFilename(e.target.value)}
                placeholder={t('meta.filenamePlaceholder')}
                title={selectedPath ?? undefined}
              />
            </div>
          )}
          <div className="flex justify-between pt-2 text-xs text-zinc-500">
            <span>
              {String(rawMetadata.ImageWidth ?? '')} x {String(rawMetadata.ImageHeight ?? '')} px
            </span>
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
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {t('meta.save')}
        </button>
        <button
          type="button"
          onClick={handleSaveAs}
          disabled={saving}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
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
