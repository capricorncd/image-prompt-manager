import { create } from 'zustand';
import type { SDImageMetadata } from '../types/metadata';
import type { Locale } from '../i18n';
import { setLocale as setI18nLocale } from '../i18n';

const LOCALE_KEY = 'image-prompt-manager:locale';
function getInitialLocale(): Locale {
  try {
    const s = localStorage.getItem(LOCALE_KEY);
    if (s === 'zh' || s === 'en' || s === 'ja') return s;
  } catch {
    // ignore
  }
  return 'zh';
}
const initialLocale = getInitialLocale();
setI18nLocale(initialLocale);

const PAGE_SIZE = 50;

/** 无原始信息时的默认元数据，便于用户仍可改文件名并另存为/覆盖保存 */
const EMPTY_METADATA: SDImageMetadata = {
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
};

interface AppState {
  directoryList: string[];
  currentDir: string | null;
  imagePaths: string[];
  hasMore: boolean;
  /** 当前文件夹内图片总数（首次分页时由 listImages 返回） */
  totalImageCount: number | null;
  loading: boolean;
  selectedPath: string | null;
  rawMetadata: Record<string, unknown>;
  metadata: SDImageMetadata | null;
  editedMetadata: SDImageMetadata | null;
  error: string | null;
  addDirectory: (dir: string) => void;
  removeDirectory: (dir: string) => void;
  setCurrentDir: (dir: string | null) => void;
  appendImages: (paths: string[], hasMore: boolean, total?: number) => void;
  clearImages: () => void;
  setLoading: (v: boolean) => void;
  selectImage: (path: string | null, meta: SDImageMetadata | null) => void;
  setRawMetadata: (tags: Record<string, unknown>) => void;
  setEditedMetadata: (meta: SDImageMetadata | null) => void;
  setError: (msg: string | null) => void;
  resetOnDirChange: () => void;
  /** 另存为后替换列表中的路径并保持选中，用于保持滚动与选中状态 */
  replaceImagePath: (originalPath: string, newPath: string) => void;
  /** 从列表中移除一张图片（如删除文件后） */
  removeImagePath: (path: string) => void;
  /** 启动时恢复目录列表（仅用于从持久化恢复） */
  restoreDirectories: (dirs: string[], currentDir: string | null) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useAppStore = create<AppState>((set) => ({
  directoryList: [],
  currentDir: null,
  imagePaths: [],
  hasMore: false,
  totalImageCount: null,
  loading: false,
  selectedPath: null,
  rawMetadata: {},
  metadata: null,
  editedMetadata: null,
  error: null,
  locale: initialLocale,

  setLocale: (locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      // ignore
    }
    setI18nLocale(locale);
    set({ locale });
  },

  addDirectory: (dir) =>
    set((s) => {
      const normalized = dir.replace(/[/\\]+$/, '');
      if (s.directoryList.some((d) => d === normalized)) return s;
      return { directoryList: [...s.directoryList, normalized] };
    }),

  removeDirectory: (dir) =>
    set((s) => {
      const normalized = dir.replace(/[/\\]+$/, '');
      const next = s.directoryList.filter((d) => d !== normalized);
      const nextCurrent = s.currentDir === normalized ? (next[0] ?? null) : s.currentDir;
      return {
        directoryList: next,
        currentDir: nextCurrent,
        imagePaths: nextCurrent === s.currentDir ? s.imagePaths : [],
        hasMore: false,
        totalImageCount: nextCurrent === s.currentDir ? s.totalImageCount : null,
        selectedPath: null,
        metadata: null,
        editedMetadata: null,
      };
    }),

  setCurrentDir: (dir) =>
    set({ currentDir: dir, imagePaths: [], hasMore: false, totalImageCount: null, selectedPath: null, metadata: null, editedMetadata: null }),

  appendImages: (paths, hasMore, total) =>
    set((s) => ({
      imagePaths: [...s.imagePaths, ...paths],
      hasMore,
      ...(total !== undefined && { totalImageCount: total }),
    })),

  clearImages: () => set({ imagePaths: [], hasMore: false, totalImageCount: null }),

  setLoading: (v) => set({ loading: v }),

  selectImage: (path, meta) =>
    set({ selectedPath: path, metadata: meta, editedMetadata: meta ? { ...meta } : { ...EMPTY_METADATA } }),

  setEditedMetadata: (meta) => set({ editedMetadata: meta }),

  setError: (msg) => set({ error: msg }),

  resetOnDirChange: () =>
    set({ imagePaths: [], hasMore: false, totalImageCount: null, selectedPath: null, metadata: null, editedMetadata: null }),

  replaceImagePath: (originalPath, newPath) =>
    set((s) => {
      const norm = (p: string) => p.replace(/\\/g, '/');
      const target = norm(originalPath);
      const idx = s.imagePaths.findIndex((p) => norm(p) === target);
      if (idx < 0) return s;
      const nextPaths = [...s.imagePaths];
      nextPaths[idx] = newPath;
      const selectedMatch = s.selectedPath ? norm(s.selectedPath) === target : false;
      return {
        imagePaths: nextPaths,
        selectedPath: selectedMatch ? newPath : s.selectedPath,
      };
    }),

  removeImagePath: (path) =>
    set((s) => {
      const norm = (p: string) => p.replace(/\\/g, '/');
      const target = norm(path);
      const nextPaths = s.imagePaths.filter((p) => norm(p) !== target);
      if (nextPaths.length === s.imagePaths.length) return s;
      const wasSelected = s.selectedPath ? norm(s.selectedPath) === target : false;
      return {
        imagePaths: nextPaths,
        selectedPath: wasSelected ? null : s.selectedPath,
        metadata: wasSelected ? null : s.metadata,
        editedMetadata: wasSelected ? null : s.editedMetadata,
        totalImageCount: s.totalImageCount != null ? s.totalImageCount - 1 : null,
      };
    }),

  setRawMetadata: (tags) => set({ rawMetadata: tags }),

  restoreDirectories: (dirs, currentDir) =>
    set({ directoryList: dirs, currentDir }),
}));

const PERSIST_KEY = 'image-prompt-manager:directories';

/** 持久化目录列表与当前目录到 localStorage */
function persistDirectories(state: { directoryList: string[]; currentDir: string | null }) {
  try {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ directoryList: state.directoryList, currentDir: state.currentDir })
    );
  } catch {
    // ignore
  }
}

/** 从 localStorage 读取已保存的目录列表 */
export function getPersistedDirectories(): { directoryList: string[]; currentDir: string | null } | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { directoryList?: string[]; currentDir?: string | null };
    if (!Array.isArray(data.directoryList)) return null;
    return {
      directoryList: data.directoryList,
      currentDir: data.currentDir ?? null,
    };
  } catch {
    return null;
  }
}

let lastPersisted: string | null = null;
useAppStore.subscribe((state) => {
  const payload = { directoryList: state.directoryList, currentDir: state.currentDir };
  const key = JSON.stringify(payload);
  if (key !== lastPersisted) {
    lastPersisted = key;
    persistDirectories(payload);
  }
});

export { PAGE_SIZE };
