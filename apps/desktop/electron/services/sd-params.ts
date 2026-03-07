/**
 * SD 参数字符串解析与序列化。
 * 格式不完全标准化（WebUI / 其他工具顺序可能不同），用正则按字段名识别，与顺序无关。
 */
import type { SDImageMetadata } from '../types/metadata.js';

const FIELD_REGEXES: Array<{
  key: keyof SDImageMetadata;
  pattern: RegExp;
  transform: (m: RegExpMatchArray) => string | number | null;
}> = [
  { key: 'steps', pattern: /Steps:\s*(\d+)/i, transform: (m) => parseInt(m[1]!, 10) },
  { key: 'sampler', pattern: /Sampler:\s*([^,]+?)(?=\s*,\s*\w+:|$)/i, transform: (m) => m[1]!.trim() },
  { key: 'cfgScale', pattern: /CFG\s*scale:\s*([\d.]+)/i, transform: (m) => parseFloat(m[1]!) },
  { key: 'seed', pattern: /Seed:\s*(\d+)/i, transform: (m) => parseInt(m[1]!, 10) },
  { key: 'size', pattern: /Size:\s*(\d+\s*x\s*\d+|\d+\s*×\s*\d+)/i, transform: (m) => m[1]!.replace(/\s/g, '') },
  { key: 'modelHash', pattern: /Model\s*hash:\s*([^,]+?)(?=\s*,\s*\w+:|$)/i, transform: (m) => m[1]!.trim() },
  { key: 'model', pattern: /Model:\s*([^,]+?)(?=\s*,\s*\w+:|$)/i, transform: (m) => m[1]!.trim() },
];

/** 从 SD 参数字符串解析出结构化对象，顺序无关 */
export function parseSDParameters(raw: string, userComment: string): SDImageMetadata {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  let prompt = '';
  let negativePrompt = '';
  const rest: string[] = [];

  const negLineMatch = normalized.match(/\n\s*Negative\s+prompt:\s*(.*?)(?=\n\s*\w|\n\s*$|$)/is);
  if (negLineMatch) {
    const before = normalized.slice(0, negLineMatch.index ?? 0);
    prompt = before.trim();
    negativePrompt = negLineMatch[1]!.trim();
    const afterNeg = normalized.slice((negLineMatch.index ?? 0) + negLineMatch[0].length);
    rest.push(afterNeg.trim());
  } else {
    const firstLineEnd = normalized.indexOf('\n');
    if (firstLineEnd >= 0) {
      prompt = normalized.slice(0, firstLineEnd).trim();
      rest.push(normalized.slice(firstLineEnd + 1).trim());
    } else {
      prompt = normalized;
    }
  }

  const restStr = rest.join('\n');
  const parsed: Record<string, string | number | null> = {};
  for (const { key, pattern, transform } of FIELD_REGEXES) {
    const m = restStr.match(pattern);
    parsed[key] = m ? transform(m) : null;
  }

  if (normalized.startsWith('{')) {
    try {
      const obj = JSON.parse(normalized) as Record<string, unknown>;
      if (
        obj &&
        typeof obj === 'object' &&
        !Array.isArray(obj) &&
        typeof obj['prompt'] === 'string'
      ) {
        prompt = obj['prompt'];
      }
    } catch {
      /* 非 JSON 或解析失败，保留上面按行解析的 prompt */
    }
  }

  return {
    prompt,
    negativePrompt,
    steps: (parsed['steps'] as number | null) ?? null,
    sampler: (parsed['sampler'] as string | null) ?? null,
    cfgScale: (parsed['cfgScale'] as number | null) ?? null,
    seed: (parsed['seed'] as number | null) ?? null,
    size: (parsed['size'] as string | null) ?? null,
    modelHash: (parsed['modelHash'] as string | null) ?? null,
    model: (parsed['model'] as string | null) ?? null,
    raw: normalized,
    userComment,
  };
}

/** 将结构化元数据序列化为 SD 参数字符串（用于写回 PNG Parameters） */
export function serializeSDParameters(m: SDImageMetadata): string {
  const lines: string[] = [m.prompt];
  if (m.negativePrompt) {
    lines.push(`Negative prompt: ${m.negativePrompt}`);
  }
  const parts: string[] = [];
  if (m.steps != null) parts.push(`Steps: ${m.steps}`);
  if (m.sampler) parts.push(`Sampler: ${m.sampler}`);
  if (m.cfgScale != null) parts.push(`CFG scale: ${m.cfgScale}`);
  if (m.seed != null) parts.push(`Seed: ${m.seed}`);
  if (m.size) parts.push(`Size: ${m.size}`);
  if (m.modelHash) parts.push(`Model hash: ${m.modelHash}`);
  if (m.model) parts.push(`Model: ${m.model}`);
  if (parts.length) {
    lines.push(parts.join(', '));
  }
  return lines.join('\n');
}
