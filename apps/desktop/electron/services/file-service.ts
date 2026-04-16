import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { isPathUnderBase } from './path-validator.js';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

function isImageFile(name: string): boolean {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

/**
 * 列出目录下的子目录路径（一层），用于左侧目录树。
 */
export async function listDirectories(dirPath: string): Promise<string[]> {
  const names = await fs.promises.readdir(dirPath, { withFileTypes: true });
  return names
    .filter((d) => d.isDirectory())
    .map((d) => path.join(dirPath, d.name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * 分页列出目录中的图片文件路径（相对或绝对由调用方决定）。
 * 不一次性读入全部到内存后只取一页：先 readdir 再过滤再 slice，避免大目录时前端卡死。
 */
export async function listImageFiles(
  dirPath: string,
): Promise<{ entries: string[]; total: number }> {
  const names = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const files = names
    .filter((d) => d.isFile() && isImageFile(d.name))
    .map((d) => path.join(dirPath, d.name))
    .sort((a, b) => a.localeCompare(b));
  const total = files.length;
  return { entries: files, total };
}

const watchers = new Map<string, FSWatcher>();

/**
 * 使用 chokidar 监听目录变化（不轮询）。同一目录多次调用会复用同一 watcher。
 * 变更时通过 onEvent 回调通知（由 IPC 层转发给渲染进程）。
 */
export function watchDirectory(
  dirPath: string,
  onEvent: (event: 'add' | 'unlink' | 'change', fullPath: string) => void
): () => void {
  const key = path.normalize(path.resolve(dirPath));
  const existing = watchers.get(key);
  if (existing) {
    return () => {
      existing.close();
      watchers.delete(key);
    };
  }
  const watcher = chokidar.watch(key, {
    persistent: true,
    ignoreInitial: true,
    depth: 1,
  });
  watcher
    .on('add', (p) => isImageFile(p) && onEvent('add', p))
    .on('unlink', (p) => isImageFile(p) && onEvent('unlink', p))
    .on('change', (p) => isImageFile(p) && onEvent('change', p));
  watchers.set(key, watcher);
  return () => {
    watcher.close();
    watchers.delete(key);
  };
}

/** 校验 path 是否在 base 下（用于 IPC 前的路径校验） */
export { isPathUnderBase };
