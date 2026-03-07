import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  readImageInfo,
  writeImageInfo,
  saveImageWithMetadata,
  endExifTool,
  getEmptyParameters,
} from './services/metadata-service.js';
import {
  listImageFiles,
  listDirectories,
  watchDirectory,
  isPathUnderBase,
} from './services/file-service.js';
import type { SDImageMetadata, PNGMetadata } from './types/metadata.js';
import {
  addOpenedRoot,
  removeOpenedRoot,
  getOpenedRoots,
  validatePathUnderRoot,
} from './shared-state.js';

const unwatchFns = new Map<string, () => void>();

function getMainWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows();
  return wins.length ? (wins[0] as BrowserWindow) : null;
}

function validateUnderRoot(filePath: string): boolean {
  return validatePathUnderRoot(filePath);
}

export function registerIpcHandlers(): void {
  ipcMain.handle('app:ping', (): 'pong' => 'pong');

  ipcMain.handle('dialog:openDirectory', async (): Promise<string | null> => {
    const win = getMainWindow() ?? undefined;
    const result = await dialog.showOpenDialog(win as InstanceType<typeof BrowserWindow>, {
      properties: ['openDirectory'],
      title: '选择图片所在文件夹',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const dir = path.resolve(result.filePaths[0]!);
    addOpenedRoot(dir);

    const mainWin = getMainWindow();
    if (mainWin) {
      const key = path.normalize(dir);
      const existing = unwatchFns.get(key);
      if (existing) existing();
      const unwatch = watchDirectory(dir, (event, fullPath) => {
        mainWin.webContents.send('fs:dir-changed', { event, fullPath });
      });
      unwatchFns.set(key, unwatch);
    }
    return dir;
  });

  ipcMain.handle('fs:removeDirectory', async (_, dirPath: string): Promise<void> => {
    const key = path.normalize(path.resolve(dirPath));
    const unwatch = unwatchFns.get(key);
    if (unwatch) {
      unwatch();
      unwatchFns.delete(key);
    }
    removeOpenedRoot(dirPath);
  });

  ipcMain.handle(
    'fs:listImages',
    async (
      _,
      dirPath: string,
      offset: number,
      limit: number
    ): Promise<{ entries: string[]; hasMore: boolean }> => {
      const resolved = path.resolve(dirPath);
      const roots = getOpenedRoots();
      const underAny = roots.some((root) => isPathUnderBase(resolved, root));
      if (!underAny) {
        return { entries: [], hasMore: false };
      }
      return listImageFiles(resolved, offset, limit);
    }
  );

  ipcMain.handle('fs:listDirs', async (_, dirPath: string): Promise<string[]> => {
    const resolved = path.resolve(dirPath);
    const roots = getOpenedRoots();
    const underAny = roots.some((root) => isPathUnderBase(resolved, root));
    if (!underAny) return [];
    try {
      return await listDirectories(resolved);
    } catch {
      return [];
    }
  });

  ipcMain.handle('fs:deleteFile', async (_, filePath: string): Promise<{ ok: boolean; error?: string }> => {
    if (!validateUnderRoot(filePath)) {
      return { ok: false, error: '路径不在当前工作目录内' };
    }
    try {
      await fs.promises.unlink(path.resolve(filePath));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  /** 由主进程用 path.join 构建“默认保存路径”，保证平台路径正确 */
  ipcMain.handle(
    'path:buildSavePath',
    (_, originalPath: string, nameNoExt: string): string => {
      const resolved = path.resolve(originalPath);
      if (!validateUnderRoot(resolved)) return '';
      const dir = path.dirname(resolved);
      const ext = path.extname(resolved) || '.png';
      const base = (nameNoExt || path.basename(resolved, ext)).replace(/\.[^.]+$/, '');
      return path.join(dir, base + ext);
    }
  );

  /** 在主进程内直接弹出另存为对话框并返回用户选择路径；不传 parent 避免部分系统下对话框被遮挡 */
  ipcMain.handle(
    'dialog:saveFileWithSuggestedName',
    async (_, originalPath: string, nameNoExt: string): Promise<string | null> => {
      try {
        if (!originalPath || typeof originalPath !== 'string') return null;
        const resolved = path.resolve(originalPath);
        if (!validateUnderRoot(resolved)) return null;
        const dir = path.dirname(resolved);
        const ext = path.extname(resolved) || '.png';
        const base = (nameNoExt || path.basename(resolved, ext)).trim().replace(/\.[^.]+$/, '') || path.basename(resolved, ext);
        const defaultPath = path.join(dir, base + ext);
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.focus();
          win.moveTop?.();
        }
        const dialogWin = win && !win.isDestroyed() ? win : undefined;
        const result = await dialog.showSaveDialog(dialogWin as InstanceType<typeof BrowserWindow>, {
          defaultPath,
          title: '另存为',
          buttonLabel: '保存',
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
        });
        if (result.canceled || !result.filePath) return null;
        return result.filePath;
      } catch (e) {
        console.error('[saveFileWithSuggestedName]', e);
        return null;
      }
    }
  );

  ipcMain.handle('dialog:saveFile', async (_, defaultPath: string): Promise<string | null> => {
    if (!defaultPath || typeof defaultPath !== 'string') return null;
    const normalized = path.normalize(path.resolve(defaultPath));
    const win = getMainWindow() ?? undefined;
    try {
      const result = await dialog.showSaveDialog(win as InstanceType<typeof BrowserWindow>, {
        defaultPath: normalized,
        title: '另存为',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    } catch (e) {
      console.error('showSaveDialog error', e);
      return null;
    }
  });

  ipcMain.handle('metadata:read', async (_, filePath: string): Promise<PNGMetadata> => {
    if (!validateUnderRoot(filePath)) return { tags: {}, parameters: getEmptyParameters() };
    return readImageInfo(path.resolve(filePath));
  });

  /** 另存为：复制到新路径并写入元数据，不覆盖原图 */
  ipcMain.handle(
    'metadata:saveAs',
    async (
      _,
      originalPath: string,
      targetPath: string,
      meta: SDImageMetadata
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!validateUnderRoot(originalPath)) {
        return { ok: false, error: '路径不在当前工作目录内' };
      }
      const targetResolved = path.resolve(targetPath);
      const roots = getOpenedRoots();
      const targetUnderAny = roots.some((r) => isPathUnderBase(targetResolved, r));
      if (roots.length > 0 && !targetUnderAny) {
        return { ok: false, error: '目标路径不在当前工作目录内' };
      }
      try {
        await saveImageWithMetadata(
          path.resolve(originalPath),
          meta,
          targetResolved
        );
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  /** 原地覆盖写入（仅在用户明确选择时由前端调用）；成功时写后重读并返回最新 meta 供前端刷新 */
  ipcMain.handle(
    'metadata:write',
    async (
      _,
      filePath: string,
      meta: SDImageMetadata
    ): Promise<{ ok: boolean; error?: string; meta?: PNGMetadata | null }> => {
      if (!validateUnderRoot(filePath)) {
        return { ok: false, error: '路径不在当前工作目录内' };
      }
      try {
        const resolved = path.resolve(filePath);
        await writeImageInfo(resolved, meta);
        const readBack = await readImageInfo(resolved);
        return { ok: true, meta: readBack };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );
}

export async function onAppQuit(): Promise<void> {
  unwatchFns.forEach((fn) => fn());
  unwatchFns.clear();
  await endExifTool();
}
