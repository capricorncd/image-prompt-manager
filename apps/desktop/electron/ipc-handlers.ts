import { BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
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

  /** 拖入路径（文件或文件夹）：若是文件则取其所在目录，加入已打开列表并开启监听，返回解析后的目录路径或 null */
  ipcMain.handle('dialog:addDirectoryByPath', async (_, rawPath: string): Promise<string | null> => {
    if (!rawPath || typeof rawPath !== 'string') return null;
    const resolved = path.resolve(rawPath.trim());
    let dir: string;
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        dir = resolved;
      } else if (stat.isFile()) {
        dir = path.dirname(resolved);
      } else {
        return null;
      }
    } catch {
      return null;
    }
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

  /** 重命名目录（同级改名）：仅允许已打开的根目录本身改名 */
  ipcMain.handle(
    'fs:renameDir',
    async (
      _,
      dirPath: string,
      newName: string
    ): Promise<{ ok: boolean; newPath?: string; error?: string }> => {
      try {
        if (!dirPath || typeof dirPath !== 'string') return { ok: false, error: '无效路径' };
        if (!newName || typeof newName !== 'string') return { ok: false, error: '无效名称' };
        const resolvedOld = path.resolve(dirPath);
        const roots = getOpenedRoots().map((p) => path.resolve(p));
        const isRoot = roots.some((r) => path.resolve(r) === resolvedOld);
        if (!isRoot) return { ok: false, error: '仅允许重命名已打开的目录' };
        const trimmed = newName.trim();
        if (!trimmed) return { ok: false, error: '名称不能为空' };
        if (trimmed.includes(path.sep) || trimmed.includes('/') || trimmed.includes('\\')) {
          return { ok: false, error: '名称不能包含路径分隔符' };
        }
        const parent = path.dirname(resolvedOld);
        const resolvedNew = path.join(parent, trimmed);
        if (path.resolve(resolvedNew) === resolvedOld) return { ok: true, newPath: resolvedOld };
        if (fs.existsSync(resolvedNew)) return { ok: false, error: '目标已存在' };

        await fs.promises.rename(resolvedOld, resolvedNew);

        // 更新 watcher：停止旧目录监听，启动新目录监听
        const mainWin = getMainWindow();
        const oldKey = path.normalize(resolvedOld);
        const unwatch = unwatchFns.get(oldKey);
        if (unwatch) {
          unwatch();
          unwatchFns.delete(oldKey);
        }
        removeOpenedRoot(resolvedOld);
        addOpenedRoot(resolvedNew);
        if (mainWin) {
          const newKey = path.normalize(resolvedNew);
          const existing = unwatchFns.get(newKey);
          if (existing) existing();
          const unwatchNew = watchDirectory(resolvedNew, (event, fullPath) => {
            mainWin.webContents.send('fs:dir-changed', { event, fullPath });
          });
          unwatchFns.set(newKey, unwatchNew);
        }
        return { ok: true, newPath: resolvedNew };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  ipcMain.handle(
    'fs:listImages',
    async (
      _,
      dirPath: string,
      offset: number,
      limit: number
    ): Promise<{ entries: string[]; hasMore: boolean; total: number }> => {
      const resolved = path.resolve(dirPath);
      const roots = getOpenedRoots();
      const underAny = roots.some((root) => isPathUnderBase(resolved, root));
      if (!underAny) {
        return { entries: [], hasMore: false, total: 0 };
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
      const resolved = path.resolve(filePath);
      await shell.trashItem(resolved);
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

/** 设置应用菜单：File 下增加语言子菜单（中文 / English / 日本語） */
export function setupAppMenu(): void {
  const sendLocale = (locale: string) => {
    getMainWindow()?.webContents.send('app:locale', locale);
  };
  const template: Parameters<typeof Menu.buildFromTemplate>[0] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Language',
          submenu: [
            { label: '中文', click: () => sendLocale('zh') },
            { label: 'English', click: () => sendLocale('en') },
            { label: '日本語', click: () => sendLocale('ja') },
          ],
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    { role: 'help' },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

export async function onAppQuit(): Promise<void> {
  unwatchFns.forEach((fn) => fn());
  unwatchFns.clear();
  await endExifTool();
}
