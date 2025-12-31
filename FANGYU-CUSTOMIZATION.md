# Fangyu Code 专属定制说明

> 🎨 从 Any-Code fork 并定制的专属版本
>
> **创建日期**: 2025-12-25
> **版本**: v1.0.0

---

## 🎯 定制内容总结

### 1. 应用标识修改（避免与原版冲突）

| 项目 | 原值 | 新值 |
|------|------|------|
| **应用名称** | `Any Code` | `Fangyu Code` |
| **应用 ID** | `claude.workbench.app` | `com.fangyu.code` |
| **版本号** | `5.17.1` | `1.0.0` |
| **Package Name** | `any-code` | `fangyu-code` |

**文件修改**：
- `src-tauri/tauri.conf.json` (3、5、14 行)
- `package.json` (2-7 行)

---

### 2. 应用图标更换

✅ **已使用 FANGYU LOGO 生成所有尺寸的图标**

**图标文件**（15 个 PNG）：
- `32x32.png` - Tauri 小图标
- `128x128.png` - Tauri 标准图标
- `128x128@2x.png` (256x256) - Retina 屏幕
- `icon.png` (512x512) - 主图标
- Windows Store 图标系列（30x30 ~ 310x310）
- `icon-256.png` - 用于生成 ICO

**图标位置**: `F:\Any-Code-Dev\src-tauri\icons\`

⚠️ **待处理**：
- `icon.ico` (Windows) - 需要使用在线工具转换或 ImageMagick
- `icon.icns` (macOS) - 需要在 macOS 上用 iconutil 生成

---

### 3. 自动更新配置

🔒 **已禁用自动更新**（专属版本不应从原版更新）

**文件修改**：
- `src-tauri/tauri.conf.json` (40-42 行)
- 从 `"active": true` 改为 `"active": false`

---

### 4. 品牌元素修改

#### 4.1 窗口标题
**文件**: `src-tauri/tauri.conf.json` (14 行)
- `"title": "Fangyu Code"`

**文件**: `src/hooks/useTabs.tsx` (511、558 行)
- 标签页标题：`${title} - Fangyu Code`

#### 4.2 关于对话框
**文件**: `src/components/dialogs/AboutDialog.tsx`
- 应用标题：`Fangyu Code` (59 行)
- 版权信息：`© 2025 Fangyu Code. All rights reserved.` (99 行)

#### 4.3 国际化文本
**文件修改**：
- `src/i18n/locales/zh.json` (1337 行) - 简体中文
- `src/i18n/locales/zh-TW.json` (1329 行) - 繁体中文
- `src/i18n/locales/en.json` (1305 行) - 英文

**新描述**：
- 中文: "Fangyu Code 是专为 Fangyu 定制的 AI 开发工具，基于 Claude Code CLI 打造，提供强大的会话管理和 AI 交互功能。"
- English: "Fangyu Code is a customized AI development tool exclusively for Fangyu, built on Claude Code CLI with powerful session management and AI interaction features."

---

### 5. 应用描述更新

**文件**: `src-tauri/tauri.conf.json` (60-63 行)

```json
"copyright": "© 2025 Fangyu",
"shortDescription": "Fangyu 专属 AI 开发工具",
"longDescription": "Fangyu Code 是专为 Fangyu 定制的 AI 开发工具，基于 Claude Code CLI 打造。提供直观的界面用于 AI 驱动的开发工作流、项目管理和高级 AI 交互。"
```

---

### 6. 数据存储目录

💡 **保持原有 `~/.claude` 目录**（未修改）

**理由**：
- Fangyu Code 和 Any-Code 都是 Claude Code CLI 的 GUI 工具
- 需要读取同一个 Claude Code CLI 配置
- 两个应用共享配置不会冲突（只是 GUI 工具）
- 应用 ID 已不同，安装/运行不会冲突

---

## 🛠️ 构建说明

### 环境要求

1. **Node.js** ✅ 已安装
2. **Rust** ⏳ 正在安装（通过 winget）
3. **npm** ✅ 已安装

### 构建步骤

```bash
# 1. 进入项目目录
cd F:\Any-Code-Dev

# 2. 依赖已安装，无需重新安装
# npm install  # 已完成

# 3. 开发模式运行（测试效果）
npm run tauri:dev

# 4. 正式构建（生成安装包）
npm run tauri:build

# 5. 快速构建（开发版，更快）
npm run tauri:build-fast
```

### 构建输出位置

```
F:\Any-Code-Dev\src-tauri\target\release\
├── Fangyu Code.exe           # Windows 可执行文件
└── bundle\
    ├── nsis\
    │   └── Fangyu Code_1.0.0_x64-setup.exe  # Windows 安装程序
    └── msi\
        └── Fangyu Code_1.0.0_x64_zh-CN.msi  # Windows MSI 安装包
```

---

## 🎨 视觉识别

### LOGO 来源
**文件**: `E:\Desktop\1Going Global\LOGO矢量图.png`
- **尺寸**: 800x752
- **品牌**: FANGYU
- **设计**: 蓝色调 C 形 LOGO

### 品牌色彩
应用会继承 LOGO 的蓝色调（已在图标中体现）

---

## 📝 与原版的差异

| 项目 | Any-Code | Fangyu Code |
|------|----------|-------------|
| **应用 ID** | `claude.workbench.app` | `com.fangyu.code` |
| **窗口标题** | `Any Code` | `Fangyu Code` |
| **应用图标** | 原版图标 | FANGYU LOGO |
| **自动更新** | ✅ 启用 | ❌ 禁用 |
| **版本号** | `5.17.1` | `1.0.0` |
| **安装位置** | `C:\Program Files\Any Code\` | `C:\Program Files\Fangyu Code\` |
| **快捷方式** | `Any Code` | `Fangyu Code` |
| **数据目录** | `~/.claude` | `~/.claude`（共享） |

---

## ✅ 完成清单

- [x] 修改应用名称和 ID
- [x] 更换应用图标（PNG）
- [x] 禁用自动更新
- [x] 修改窗口标题
- [x] 修改关于对话框
- [x] 更新国际化文本
- [x] 更新 package.json
- [x] 更新应用描述
- [ ] 生成 Windows ICO 图标（可选，构建时可能自动生成）
- [ ] 生成 macOS ICNS 图标（需在 macOS 上）
- [ ] 构建并测试专属版本

---

## 🚀 下一步

1. **等待 Rust 安装完成**
2. **运行开发模式测试**：`npm run tauri:dev`
3. **构建最终版本**：`npm run tauri:build`
4. **安装并测试**
5. **验证与原版 Any-Code 并存无冲突**

---

## 📦 辅助脚本

**图标生成脚本**: `F:\Any-Code-Dev\generate-icons.mjs`
- 使用用户 LOGO 生成所有尺寸的 PNG 图标
- 运行: `node generate-icons.mjs`

---

**创建者**: Claude Opus 4.5 🤖
**定制日期**: 2025-12-25
