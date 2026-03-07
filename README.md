# Image Prompt Manager

基于 Electron 的桌面应用，用于编辑AI生成图片的元数据（主要为了给图片添加提示词）。

查看 AI 生成图片的元数据（如 Stable Diffusion 的 prompt、负向提示词、种子、模型等）。

> Windows测试只能修改UserComment, SD的Praramaters修改后无法保存图片。

## 技术栈

| 层级     | 技术 |
|----------|------|
| 桌面壳   | Electron |
| 构建     | Vite、TypeScript |
| 前端     | React 19、TailwindCSS、Zustand |
| 元数据   | exiftool-vendored（PNG Parameters / EXIF UserComment） |
| 文件/目录 | Node.js fs、chokidar |

## 环境要求

- **Node.js** >= 24.0.0
- **npm** 7+（支持 workspaces）

## 安装与运行

```bash
# 克隆仓库
git clone https://github.com/capricorncd/image-prompt-manager.git
cd image-prompt-manager

# 安装依赖（根目录会安装 workspace 下所有包）
npm install

# 开发模式（带 DevTools）
npm run dev

# 打包生产版本
npm run build
```

开发模式下会默认打开渲染进程的开发者工具控制台，便于调试。

## 项目结构

```
image-prompt-manager/
├── package.json              # 根 workspace 与脚本
├── README.md
├── docs/
│   └── PROJECT_STRUCTURE.md  # 详细目录与依赖说明
│
└── apps/
    └── desktop/              # Electron 桌面应用
        ├── package.json
        ├── vite.config.ts
        ├── electron/         # 主进程
        │   ├── main.ts       # 窗口、协议、IPC 注册
        │   ├── preload.ts    # 安全 API 暴露
        │   ├── ipc-handlers.ts
        │   ├── services/     # 元数据、文件、路径校验
        │   └── types/
        └── src/              # 渲染进程（React）
            ├── main.tsx
            ├── App.tsx
            ├── components/   # Layout、DirectorySidebar、ImageGrid、MetadataPanel
            ├── stores/       # Zustand 状态
            ├── types/
            └── lib/
```

## 使用说明

1. **打开文件夹**：点击左侧「打开文件夹」，选择存放图片的目录（可多次添加不同目录）。
2. **浏览图片**：中间网格显示当前目录下的图片，点击某张图片在右侧加载其元数据。
3. **编辑元数据**：在右侧修改正向/负向提示词及各参数，可点击「原始信息」查看或编辑完整 JSON/参数字符串。
4. **保存**：
   - **覆盖保存**：直接写回当前文件（若修改了文件名则先另存为新文件再删原文件）。
   - **另存为**：选择新路径保存，可改文件名，原文件不变。
5. **无原始信息的图片**：若图片没有 SD/JSON 元数据，仍可编辑「正向提示词」并保存；有 SD 格式则按 SD 写回，否则仅写入正向提示词或合并进原有 JSON。

## 安全说明

- 主进程使用 `nodeIntegration: false`、`contextIsolation: true`，通过 preload 仅暴露约定的 API。
- 文件与目录访问限制在「已打开的目录」内，由主进程校验路径后再读写。

## 开发说明

- 主进程与预加载脚本由 Vite 构建到 `dist-electron/`，渲染进程由 Vite 打包。
- 元数据读写与 SD 参数解析见 `apps/desktop/electron/services/metadata-service.ts`、`sd-params.ts`。
- 详细依赖与目录说明见 `docs/PROJECT_STRUCTURE.md`。

### Windows 下构建若报「无法创建符号链接」

electron-builder 在解压 winCodeSign 缓存时会创建符号链接，Windows 默认无权限会报错。可选做法：

1. **用管理员权限运行**：在「以管理员身份运行」的终端中执行 `npm run build`。
2. **预填缓存（无需管理员）**：从 [winCodeSign-2.6.0 的 Source code (zip)](https://github.com/electron-userland/electron-builder-binaries/archive/refs/tags/winCodeSign-2.6.0.zip) 下载并解压，将解压后的 `electron-builder-binaries-winCodeSign-2.6.0/winCodeSign` 目录内容放到  
   `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\` 下（若已有带数字的子目录如 `696511211`，可先删掉该子目录再放解压出的内容，或新建同名子目录后放入）。之后再次执行 `npm run build` 会跳过下载与 7z 解压。

## License

MIT · Author: Capricorncd
