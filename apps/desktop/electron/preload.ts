import { contextBridge, ipcRenderer } from 'electron';

/** 主进程推送的目录变更事件 */
export type DirChangedPayload = { event: 'add' | 'unlink' | 'change'; fullPath: string };

/**
 * 仅在此处向渲染进程暴露允许调用的 IPC 方法，禁止暴露整个 ipcRenderer。
 * 对应 .cursorrules：nodeIntegration=false, contextIsolation=true，通过 preload 桥接。
 */
const electronAPI = {
  ping(): Promise<'pong'> {
    return ipcRenderer.invoke('app:ping') as Promise<'pong'>;
  },
  /** 打开文件夹对话框，返回选择的目录路径；并开始 chokidar 监听 */
  openDirectory(): Promise<string | null> {
    return ipcRenderer.invoke('dialog:openDirectory') as Promise<string | null>;
  },
  /** 分页列出目录中的图片路径，避免大目录一次性加载 */
  listImages(dirPath: string, offset: number, limit: number): Promise<{ entries: string[]; hasMore: boolean }> {
    return ipcRenderer.invoke('fs:listImages', dirPath, offset, limit) as Promise<{
      entries: string[];
      hasMore: boolean;
    }>;
  },
  /** 列出目录下一层子目录路径，用于左侧目录树 */
  listDirs(dirPath: string): Promise<string[]> {
    return ipcRenderer.invoke('fs:listDirs', dirPath) as Promise<string[]>;
  },
  /** 从列表中移除目录并停止监听 */
  removeDirectory(dirPath: string): Promise<void> {
    return ipcRenderer.invoke('fs:removeDirectory', dirPath) as Promise<void>;
  },
  /** 删除文件（仅限当前工作目录内） */
  deleteFile(filePath: string): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke('fs:deleteFile', filePath) as Promise<{ ok: boolean; error?: string }>;
  },
  /** 由主进程构建默认保存路径（与 originalPath 同目录、同后缀），保证路径格式正确 */
  buildSavePath(originalPath: string, nameNoExt: string): Promise<string> {
    return ipcRenderer.invoke('path:buildSavePath', originalPath, nameNoExt) as Promise<string>;
  },
  /** 在主进程内直接弹出另存为对话框（带建议文件名），返回用户选择路径；取消或出错返回 null */
  showSaveDialogWithSuggestedName(originalPath: string, nameNoExt: string): Promise<string | null> {
    return ipcRenderer.invoke('dialog:saveFileWithSuggestedName', originalPath, nameNoExt) as Promise<string | null>;
  },
  /** 另存为对话框，返回用户选择的目标路径 */
  showSaveDialog(defaultPath: string): Promise<string | null> {
    return ipcRenderer.invoke('dialog:saveFile', defaultPath) as Promise<string | null>;
  },
  /** 读取图片 SD 元数据（优先 PNG parameters，其次 EXIF UserComment） */
  readImageMetadata(filePath: string): Promise<import('./types/metadata.js').PNGMetadata | null> {
    return ipcRenderer.invoke('metadata:read', filePath) as Promise<import('./types/metadata.js').PNGMetadata | null>;
  },
  /** 另存为：复制到新路径并写入元数据，不覆盖原图 */
  saveImageWithMetadata(
    originalPath: string,
    targetPath: string,
    meta: import('./types/metadata.js').SDImageMetadata
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke('metadata:saveAs', originalPath, targetPath, meta) as Promise<{
      ok: boolean;
      error?: string;
    }>;
  },
  /** 原地覆盖写入元数据（仅当用户明确选择覆盖时调用） */
  writeImageMetadata(
    filePath: string,
    meta: import('./types/metadata.js').SDImageMetadata
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke('metadata:write', filePath, meta) as Promise<{ ok: boolean; error?: string; meta?: import('./types/metadata.js').PNGMetadata | null }>;
  },
  /** 订阅当前打开目录的文件变更（chokidar 推送，非轮询） */
  onDirChanged(callback: (payload: DirChangedPayload) => void): () => void {
    const handler = (_: unknown, payload: DirChangedPayload) => callback(payload);
    ipcRenderer.on('fs:dir-changed', handler);
    return () => {
      ipcRenderer.removeListener('fs:dir-changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type PreloadAPI = typeof electronAPI;
