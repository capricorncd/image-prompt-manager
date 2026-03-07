import fs from 'fs';
import path from 'path';
import { exiftool } from 'exiftool-vendored';
import type { SDImageMetadata } from '../types/metadata.js';
import { parseSDParameters, serializeSDParameters } from './sd-params.js';

/** ExifTool 中 PNG parameters 的 tag 名（PNG tEXt 键 "parameters"） */
const PNG_PARAMETERS_TAG = 'Parameters';
const EXIF_USER_COMMENT_TAG = 'UserComment';

function getRawParameters(tags: Record<string, unknown>): string | undefined {
  const v = tags[PNG_PARAMETERS_TAG] ?? tags[EXIF_USER_COMMENT_TAG] ?? tags['parameters'];
  return typeof v === 'string' ? v : undefined;
}

/**
 * 从图片文件读取 SD 元数据。
 * 优先使用 PNG tEXt 键 "parameters"，其次 EXIF UserComment。
 */
export async function readImageInfo(filePath: string): Promise<SDImageMetadata | null> {
  try {
    const tags = (await exiftool.read(filePath)) as Record<string, unknown>;
    const raw = getRawParameters(tags);
    if (!raw) return null;
    return parseSDParameters(raw);
  } catch {
    return null;
  }
}

/**
 * 仅修改指定文件的元数据（原地写入）。
 * 仅写入 PNG Parameters tEXt，不破坏图像数据。
 */
export async function writeImageInfo(filePath: string, meta: SDImageMetadata): Promise<void> {
  const value = serializeSDParameters(meta);
  await exiftool.write(filePath, { [PNG_PARAMETERS_TAG]: value } as Record<string, string>);
}

/**
 * 另存为：复制原图到目标路径，再对新文件写入元数据。
 * 不覆盖原图，保证图像二进制不被破坏，只修改/添加 Text Chunk。
 */
export async function saveImageWithMetadata(
  originalPath: string,
  meta: SDImageMetadata,
  targetPath: string
): Promise<void> {
  await fs.promises.copyFile(originalPath, targetPath);
  await exiftool.write(targetPath, { [PNG_PARAMETERS_TAG]: serializeSDParameters(meta) } as Record<string, string>);
}

/** 应用退出时关闭 exiftool 子进程 */
export async function endExifTool(): Promise<void> {
  await exiftool.end();
}
