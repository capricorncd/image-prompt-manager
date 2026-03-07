# 项目目录结构与依赖规划

## 一、目录结构（npm workspace）

```
image-prompt-manager/
├── package.json                    # 工作区根：workspaces = ["apps/*", "modules/*"]
├── .cursorrules
├── README.md
├── docs/
│   └── PROJECT_STRUCTURE.md        # 本文件
│
├── apps/
│   └── desktop/                    # Electron 桌面应用
│       ├── package.json
│       ├── index.html              # Vite 入口 HTML
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       │
│       ├── electron/               # 主进程与预加载（不经过 Vite 打包主进程时可用 electron-builder 配置）
│       │   ├── main.ts             # Electron 主进程
│       │   └── preload.ts          # 预加载脚本（安全 IPC 桥）
│       │
│       ├── src/                    # 渲染进程：Vite + React
│       │   ├── main.tsx            # React 入口
│       │   ├── App.tsx
│       │   ├── components/         # UI 组件
│       │   │   ├── ui/             # Shadcn 等基础组件
│       │   │   ├── DirectoryTree.tsx
│       │   │   ├── ImageGrid.tsx
│       │   │   └── MetadataPanel.tsx
│       │   ├── stores/             # Zustand 状态
│       │   ├── services/           # 通过 preload 调用的 API 封装
│       │   ├── types/              # 前端类型（与 IPC 一致）
│       │   └── lib/
│       └── resources/              # 图标等静态资源（可选）
│
└── modules/
    └── utils/                      # 共享工具与类型
        ├── package.json
        └── src/
            ├── index.ts
            └── sd-params.ts        # SD 参数解析/序列化（可选放主进程）
```

说明：

- **根目录**：仅做 workspace 聚合与顶层脚本（如 `npm run dev` 在 `apps/desktop` 启动）。
- **apps/desktop**：Electron 主进程（`electron/main.ts`）、预加载（`electron/preload.ts`）、渲染进程（Vite + React 在 `src/`）。
- **modules/utils**：共享类型、常量或 SD 参数字符串解析等，供 desktop 主进程或渲染进程复用。

---

## 二、依赖列表

### 2.1 根目录 `package.json`

- **workspaces**：`["apps/*", "modules/*"]`（已有）。
- **scripts**：委托到 desktop 的 dev/build，例如：
  - `"dev": "npm run dev -w @image-prompt-manager/desktop"`
  - `"build": "npm run build -w @image-prompt-manager/desktop"`
- **依赖**：根目录可不放业务依赖，仅 scripts 与 engines。

### 2.2 `apps/desktop/package.json`

| 类型 | 包名 | 用途 |
|------|------|------|
| **生产依赖 (dependencies)** | | |
| | `exiftool-vendored` | 读写图片元数据（推荐）。支持 PNG/EXIF 等，可读 EXIF UserComment 等；优先用 PNG tEXt 时需配合底层或 ExifTool 的 PNG 支持。 |
| | `chokidar` | 目录与文件变更监听，用于左侧目录树与图片列表的实时刷新。 |
| | `react` | 渲染进程 UI。 |
| | `react-dom` | 渲染进程挂载。 |
| | `zustand` | 前端状态管理。 |
| | `clsx` | 条件 class 拼接（Shadcn 等）。 |
| | `tailwind-merge` | Tailwind 类名合并（Shadcn）。 |
| | `class-variance-authority` | 组件变体样式（Shadcn）。 |
| | `lucide-react` | 图标。 |
| | `react-window` | 图片网格虚拟列表，支持 1000+ 图片。 |
| **开发依赖 (devDependencies)** | | |
| | `electron` | Electron 运行时。 |
| | `electron-builder` | 打包。 |
| | `vite` | 构建与 HMR。 |
| | `@vitejs/plugin-react` | React + JSX 支持。 |
| | `vite-plugin-electron` | 将 Electron 主进程/预加载与 Vite 串联。 |
| | `typescript` | TS 编译。 |
| | `@types/react`、`@types/react-dom`、`@types/node` | 类型定义。 |
| | `tailwindcss`、`postcss`、`autoprefixer` | Tailwind 样式。 |
| | `@tailwindcss/typography` | 可选，右侧面板排版。 |

**PNG 元数据方案说明：**

- **首选：`exiftool-vendored`**  
  - 跨平台、功能全面，适合同时处理 EXIF（如 UserComment）与多种格式；对 PNG 的 tEXt 支持依赖 ExifTool 自身能力，需在实现时验证 “parameters” 的读写。
- **备选（仅需 tEXt 时）：**  
  - `png-chunks-extract` + `png-chunks-encode` + `png-chunk-text`：仅操作 PNG tEXt 块，轻量，与 SD WebUI 的 “parameters” 完全匹配；若后续不做 EXIF 或其它格式，可只采用此方案。

若希望**先实现 “parameters” 且尽量少依赖**，可仅用 `png-chunks-extract` + `png-chunks-encode` + `png-chunk-text`；若希望**统一处理 EXIF + PNG 且长期扩展**，采用 `exiftool-vendored` 更稳妥。本规划以 **exiftool-vendored** 为主，在实现时若发现 PNG tEXt 支持不足再引入上述三包作为补充。

### 2.3 `modules/utils/package.json`

- 当前可为空依赖或仅 `typescript`（dev）。若将 SD 参数字符串解析（如 “Steps: 20, Sampler: …” 的拆分）放到 utils，可只保留类型与纯 TS 工具函数，无需额外运行时依赖。

---

## 三、下一步（第二步及之后）

- **第二步**：在 `apps/desktop` 中创建 `electron/main.ts`、`electron/preload.ts`，关闭 `nodeIntegration`、开启 `contextIsolation`，通过 preload 暴露有限 IPC API。
- **第三步**：在主进程实现 `readImageMetadata(path)`，优先解析 PNG tEXt 键 `parameters`，并解析 SD 参数字段（prompt、Negative prompt、Steps、Seed 等）。
- **第四步**：实现左侧目录树、中间虚拟化图片网格、右侧元数据编辑面板，并与 IPC 对接。

以上为第一步：项目目录结构与依赖规划。若确认采用 `exiftool-vendored` 或改为仅用 `png-chunk-*` 方案，可据此修改 `apps/desktop/package.json` 并执行 `npm install`。
