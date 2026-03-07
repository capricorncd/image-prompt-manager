/// <reference types="vite/client" />

import type { SDImageMetadata, PNGMetadata } from './types/metadata';

/** 与 electron/preload.ts 暴露的 API 保持一致 */
declare global {
  interface Window {
    electronAPI: {
      ping(): Promise<'pong'>;
      openDirectory(): Promise<string | null>;
      listImages(
        dirPath: string,
        offset: number,
        limit: number
      ): Promise<{ entries: string[]; hasMore: boolean }>;
      listDirs(dirPath: string): Promise<string[]>;
      removeDirectory(dirPath: string): Promise<void>;
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
      onDirChanged(callback: (payload: { event: 'add' | 'unlink' | 'change'; fullPath: string }) => void): () => void;
    };
  }
}

export {};
