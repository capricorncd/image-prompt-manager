import { app, BrowserWindow, shell, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers, onAppQuit } from './ipc-handlers.js';
import { validatePathUnderRoot } from './shared-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 开发环境：Vite 渲染进程地址；生产：打包后的 index.html */
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const PRELOAD_SCRIPT = path.join(__dirname, 'preload.js');

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: PRELOAD_SCRIPT,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  win.once('ready-to-show', () => {
    win.show();
    if (VITE_DEV_SERVER_URL) win.webContents.openDevTools();
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/** 注册 local:// 协议，用于渲染进程安全加载当前工作目录下的本地图片 */
function registerLocalImageProtocol(): void {
  protocol.handle('local', (request) => {
    const url = new URL(request.url);
    const pathParam = url.searchParams.get('path');
    if (!pathParam) {
      return new Response('Missing path', { status: 400 });
    }
    const filePath = decodeURIComponent(pathParam);
    if (!validatePathUnderRoot(filePath)) {
      return new Response('Forbidden', { status: 403 });
    }
    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
    return net.fetch(fileUrl);
  });
}

app.whenReady().then(() => {
  registerLocalImageProtocol();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  onAppQuit().catch(() => {});
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
