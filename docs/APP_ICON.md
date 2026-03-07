# 应用 Logo / 图标说明

打包时 electron-builder 会从 **构建资源目录** 读取图标，未提供则使用 Electron 默认图标。

## 存放位置

图标文件放在桌面应用的 **`build`** 目录下（与 `package.json` 同级）：

```
apps/desktop/
├── build/                    # 构建资源目录（electron-builder 默认）
│   ├── icon.png             # 通用：至少 256×256，可选 512×512
│   ├── icon.ico             # Windows 专用（可选，无则用 icon.png）
│   ├── icon.icns            # macOS 专用（可选，无则用 icon.png）
│   └── icon.icon            # macOS 新格式（可选，需 Xcode 26+ / macOS 15+）
├── package.json
└── ...
```

即：**`apps/desktop/build/`**。

## 格式与尺寸

| 平台 | 文件名 | 格式 | 建议尺寸 | 说明 |
|------|--------|------|----------|------|
| **Windows** | `icon.ico` 或 `icon.png` | ICO / PNG | **≥ 256×256**（建议 256×256 或 512×512） | 二选一即可，无则用默认图标 |
| **macOS** | `icon.png` 或 `icon.icns` 或 `icon.icon` | PNG / ICNS / Apple Icon | **≥ 512×512** | `.icon` 需 Xcode 26+；无则用默认图标 |
| **Linux** | 自动从 macOS/Windows 图标生成 | — | — | 或自行在 `build/icons/` 下放 `16x16.png`、`32x32.png`、`256x256.png` 等 |

## 最小可用方案

只做跨平台打包时，**只需一张图**：

- **路径**：`apps/desktop/build/icon.png`
- **格式**：PNG，透明底或纯色底均可
- **尺寸**：**至少 256×256**，推荐 **512×512**（macOS 与高 DPI 更清晰）

electron-builder 会用 `icon.png` 生成 Windows 与 Linux 所需图标；macOS 若只有 PNG 也会用该文件。

## 可选：各平台单独图标

- **Windows**：在 `build/` 下增加 `icon.ico`（多尺寸 ICO，如 16/32/48/256），打包时会优先于 `icon.png`。
- **macOS**：在 `build/` 下增加 `icon.icns`（或 `.icon`），打包时会优先于 `icon.png`。
- **Linux**：在 `build/icons/` 下放 `16x16.png`、`32x32.png`、`48x48.png`、`128x128.png`、`256x256.png`（文件名含尺寸即可）。

## 制作建议

1. 先做一张 **512×512** 的 PNG 作为主图（方形，无圆角）。
2. 放到 `apps/desktop/build/icon.png`。
3. 需要更好效果时，再用工具生成：
   - **ICO**： [AppIcon Generator](http://www.tweaknow.com/appicongenerator.php)、[MakeAppIcon](https://makeappicon.com/) 等。
   - **ICNS**：macOS 用 Icon Composer 或在线转 icns 工具。

## 配置（可选）

若把图标放到其他目录，可在 `apps/desktop/package.json` 中指定：

```json
{
  "build": {
    "directories": {
      "buildResources": "build"
    },
    "win": {
      "icon": "build/icon.ico"
    },
    "mac": {
      "icon": "build/icon.icns"
    }
  }
}
```

默认 `buildResources` 即为 `build`，一般无需修改。
