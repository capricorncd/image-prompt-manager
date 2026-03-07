import fs from 'fs';
import { exiftool } from 'exiftool-vendored';
import type { SDImageMetadata, PNGMetadata } from '../types/metadata.js';
import { parseSDParameters, serializeSDParameters } from './sd-params.js';

/** ExifTool 中 PNG parameters 的 tag 名（PNG tEXt 键 "parameters"） */
const PNG_PARAMETERS_TAG = 'Parameters';
const EXIF_USER_COMMENT_TAG = 'UserComment';

export const getEmptyParameters = (): SDImageMetadata => ({
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
});

/**
 * 从图片文件读取 SD 元数据。
 * 优先使用 PNG tEXt 键 "parameters"，其次 EXIF UserComment。
  */
export async function readImageInfo(filePath: string): Promise<PNGMetadata> {
  try {
    const tags = (await exiftool.read(filePath)) as Record<string, unknown>;
    return {
      tags,
      parameters: parseSDParameters(String(tags[PNG_PARAMETERS_TAG] ?? ''), String(tags[EXIF_USER_COMMENT_TAG] ?? ''))
    };
  } catch {
    return { tags: {}, parameters: getEmptyParameters()};
  }
}

/** 是否有 SD WebUI 格式数据（负向提示词或 Steps/Sampler/Seed 等） */
function hasSDWebUIData(meta: SDImageMetadata): boolean {
  return (
    (meta.negativePrompt != null && meta.negativePrompt.trim() !== '') ||
    meta.steps != null ||
    (meta.sampler != null && meta.sampler.trim() !== '') ||
    meta.cfgScale != null ||
    meta.seed != null ||
    (meta.size != null && meta.size.trim() !== '') ||
    (meta.model != null && meta.model.trim() !== '')
  );
}

/**
 * 原始信息是否为 JSON 对象（如 dreamina 等），若是则保留结构并合并 prompt 字段。
 */
function mergePromptIntoRawJson(meta: SDImageMetadata): string | null {
  const raw = (meta.raw ?? '').trim();
  if (raw === '' || raw[0] !== '{') return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return null;
    obj['prompt'] = (meta.prompt ?? '').trim();
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

/**
 * 决定写入 Parameters 的内容：
 * 有 SD 数据 → SD 格式；原内容是 JSON → 保留 JSON 并合并正向提示词为 prompt；否则只写正向提示词。
 */
function getValueToWrite(meta: SDImageMetadata): string {
  if (hasSDWebUIData(meta)) return serializeSDParameters(meta);
  const merged = mergePromptIntoRawJson(meta);
  if (merged != null) return merged;
  return (meta.prompt ?? '').trim();
}

/** ExifTool 写入时传入，原地覆盖原文件，不生成 *_original 备份 */
const WRITE_OVERWRITE_ARGS = ['-overwrite_original'];

/**
 * 仅修改指定文件的元数据（原地写入）。
 * 有 SD WebUI 数据则按 SD 格式写回，没有则只写入正向提示词。
 */
export async function writeImageInfo(filePath: string, meta: SDImageMetadata): Promise<void> {
  // const value = getValueToWrite(meta);
  await exiftool.write(
    filePath,
     {
       'UserComment': meta.userComment,
       // TODO: Parameters无法写入
      // 'Parameters': value
    },
    WRITE_OVERWRITE_ARGS
  );
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
  const value = getValueToWrite(meta);
  await exiftool.write(
    targetPath,
    { [PNG_PARAMETERS_TAG]: value } as Record<string, string>,
    WRITE_OVERWRITE_ARGS
  );
}

/** 应用退出时关闭 exiftool 子进程 */
export async function endExifTool(): Promise<void> {
  await exiftool.end();
}
