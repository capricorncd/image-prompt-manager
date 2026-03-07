import path from 'path';
import { isPathUnderBase } from './services/path-validator.js';

/** 已加入的目录列表，供 protocol 校验与 IPC 使用 */
let openedRoots: string[] = [];

export function getOpenedRoots(): string[] {
  return [...openedRoots];
}

export function addOpenedRoot(dir: string): void {
  const resolved = path.resolve(dir);
  if (!openedRoots.some((r) => path.resolve(r) === resolved)) {
    openedRoots.push(resolved);
  }
}

export function removeOpenedRoot(dir: string): void {
  const resolved = path.resolve(dir);
  openedRoots = openedRoots.filter((r) => path.resolve(r) !== resolved);
}

export function validatePathUnderRoot(filePath: string): boolean {
  if (openedRoots.length === 0) return false;
  const resolved = path.resolve(filePath);
  return openedRoots.some((root) => isPathUnderBase(resolved, root));
}
