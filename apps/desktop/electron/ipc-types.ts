/**
 * IPC 通道与参数类型定义，供 main/preload/renderer 共用，保证类型一致。
 * 新增 IPC 时请在此声明并在 preload 中显式暴露。
 */

// 后续实现元数据读写时会扩展
export interface IpcInvokeMap {
  // 示例：'dialog:openDirectory' -> string | null
  // 'metadata:read': (path: string) => Promise<SDImageMetadata>
  // 'metadata:write': (path: string, params: SDImageMetadata) => Promise<void>
  // 'fs:readDir': (path: string) => Promise<string[]>
}

/** 渲染进程通过 window.electronAPI 调用的方法签名（与 preload 暴露一致） */
export type ElectronAPI = {
  // invoke(channel: string, ...args: unknown[]): Promise<unknown>;
};
