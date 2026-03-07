/** 与主进程 SDImageMetadata 一致，供渲染进程使用 */
export interface SDImageMetadata {
  prompt: string;
  negativePrompt: string;
  steps: number | null;
  sampler: string | null;
  cfgScale: number | null;
  seed: number | null;
  size: string | null;
  modelHash: string | null;
  model: string | null;
  raw: string;
  userComment: string;
}
