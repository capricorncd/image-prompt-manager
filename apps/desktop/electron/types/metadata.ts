/**
 * Stable Diffusion 图片元数据结构（与 WebUI 保存的 parameters 对应）
 */
export interface SDImageMetadata {
  /** 正向提示词（第一行） */
  prompt: string;
  /** 负向提示词（Negative prompt: 后的内容） */
  negativePrompt: string;
  /** 采样步数 */
  steps: number | null;
  /** 采样器名称 */
  sampler: string | null;
  /** CFG Scale */
  cfgScale: number | null;
  /** 种子 */
  seed: number | null;
  /** 尺寸，如 "512x512" */
  size: string | null;
  /** 模型 hash */
  modelHash: string | null;
  /** 模型名称 */
  model: string | null;
  /** 原始参数字符串（未解析部分或完整备份） */
  raw: string;
}
