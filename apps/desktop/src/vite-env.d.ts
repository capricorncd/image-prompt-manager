/// <reference types="vite/client" />

import type { SDImageMetadata, PNGMetadata } from './types/metadata';

/** 与 electron/preload.ts 暴露的 API 保持一致 */
declare global {
  interface Window {
    electronAPI: {
      ping(): Promise<'pong'>;
      openDirectory(): Promise<string | null>;
      /** 从拖放得到的 File 获取本地路径（preload 中 webUtils.getPathForFile） */
      getPathForDroppedFile(file: File): string;
      addDirectoryByPath(dirPath: string): Promise<string | null>;
      listImages(dirPath: string): Promise<{ entries: string[]; total: number }>;
      listDirs(dirPath: string): Promise<string[]>;
      removeDirectory(dirPath: string): Promise<void>;
      renameDirectory(
        dirPath: string,
        newName: string
      ): Promise<{ ok: boolean; newPath?: string; error?: string }>;
      deleteFile(filePath: string): Promise<{ ok: boolean; error?: string }>;
      buildSavePath(originalPath: string, nameNoExt: string): Promise<string>;
      showSaveDialogWithSuggestedName(originalPath: string, nameNoExt: string): Promise<string | null>;
      showSaveDialog(defaultPath: string): Promise<string | null>;
      readImageMetadata(filePath: string): Promise<PNGMetadata>;
      saveImageWithMetadata(
        originalPath: string,
        targetPath: string,
        meta: SDImageMetadata
      ): Promise<{ ok: boolean; error?: string }>;
      writeImageMetadata(
        filePath: string,
        meta: SDImageMetadata
      ): Promise<{ ok: boolean; error?: string; meta?: PNGMetadata | null }>;
      onDirChanged(
        callback: (payload: { event: 'add' | 'unlink' | 'change'; fullPath: string }) => void
      ): () => void;
      /** 订阅语言切换（File > Language 菜单） */
      onLocaleChange(callback: (locale: string) => void): () => void;
    };
  }
}

export {};
