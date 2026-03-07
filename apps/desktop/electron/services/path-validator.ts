import fs from 'fs';
import path from 'path';

/**
 * 校验路径在允许的目录内，防止目录穿越。
 * 仅当 path 解析后在 baseDir 下（或等于 baseDir）时返回 true。
 */
export function isPathUnderBase(resolvedPath: string, baseDir: string): boolean {
  const normalized = path.normalize(resolvedPath);
  const base = path.normalize(path.resolve(baseDir));
  if (process.platform === 'win32') {
    return normalized.toLowerCase().startsWith(base.toLowerCase()) && normalized.length >= base.length;
  }
  return normalized.startsWith(base) && (normalized.length === base.length || normalized[base.length] === path.sep);
}

/**
 * 解析并校验：path 必须在 baseDir 下，且存在。返回规范化的绝对路径或 null。
 */
export function resolveAndValidatePath(
  inputPath: string,
  baseDir: string
): string | null {
  try {
    const resolved = path.resolve(inputPath);
    if (!isPathUnderBase(resolved, baseDir)) return null;
    if (!fs.existsSync(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}
