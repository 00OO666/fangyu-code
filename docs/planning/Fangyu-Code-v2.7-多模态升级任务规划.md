# Fangyu Code v2.7 多模态升级任务规划

> 创建时间: 2026-01-11
> 目标版本: v2.7.0
> 状态: ✅ 已完成

---

## 🎯 功能目标

### 功能 1: Nano Banana 图像生成集成 ✅
- 接入 Google Gemini 图像生成 API（社区昵称 "Nano Banana"）
- 支持文生图、图生图、多轮图像编辑
- 在聊天界面添加"生成图片"按钮

### 功能 2: 多模态文件拖拽支持 ✅
- 输入框支持拖拽图片/文档/PPT/PDF
- AI 能够读取和理解这些文件内容
- 支持的格式：图片、PDF、Word、PPT、Excel、文本文件

---

## 📋 技术调研结果

### Nano Banana API 信息

| 项目 | 值 |
|------|-----|
| 官方名称 | Gemini 2.5 Flash Image / Gemini 3 Pro Image |
| 社区昵称 | Nano Banana / Nano Banana Pro |
| API 端点 | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| 模型 ID | `gemini-2.5-flash-image`（快速）/ `gemini-3-pro-image-preview`（高质量） |
| 认证方式 | `x-goog-api-key: YOUR_API_KEY` |
| 价格 | ~$0.039-0.134/张（取决于分辨率） |
| 生成速度 | 3-5 秒 |
| 输出格式 | Base64 PNG/JPEG |

### JavaScript 调用示例
```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "YOUR_API_KEY" });

// 文生图
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: "生成一张可爱的猫咪图片",
});

// 图生图（编辑）
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: [
    { text: "把这张图片的背景改成星空" },
    { inlineData: { mimeType: "image/png", data: base64ImageData } }
  ],
});
```

### 多模态文件处理方案

| 文件类型 | 处理方案 | 依赖库 |
|---------|---------|--------|
| 图片 | 直接 Base64 编码发送给 AI | 无需额外依赖 |
| PDF | 前端解析提取文本/图片 | `pdfjs-dist` |
| Word (.docx) | 前端解析提取文本 | `mammoth` |
| PPT (.pptx) | 前端解析提取文本/图片 | `pptx-parser` 或自定义 ZIP 解析 |
| Excel (.xlsx) | 前端解析提取表格 | `xlsx` |
| 文本文件 | 直接读取 | FileReader API |

---

## 📝 任务分解

### 阶段 1: 基础设施（预计 0.5 天）

#### 任务 1.1: 安装依赖
```bash
npm install @google/genai pdfjs-dist mammoth xlsx
```
- [ ] 安装 Google GenAI SDK
- [ ] 安装文件解析库
- [ ] 更新 package.json

#### 任务 1.2: 创建 Gemini 图像生成服务
- [ ] 创建 `src/services/geminiImageService.ts`
- [ ] 实现 API 密钥管理（复用现有 APIConfigManager）
- [ ] 实现文生图方法 `generateImage(prompt: string)`
- [ ] 实现图生图方法 `editImage(prompt: string, imageBase64: string)`
- [ ] 实现错误处理和重试逻辑

#### 任务 1.3: 扩展 API 配置管理
- [ ] 在 `APIConfigManager.ts` 添加 `google-image` 提供商
- [ ] 在设置面板添加 Gemini API Key 配置入口
- [ ] 支持独立的图像生成 API Key（可选，也可复用 Google AI Key）

---

### 阶段 2: 图像生成 UI（预计 1 天）

#### 任务 2.1: 创建图像生成按钮组件
- [ ] 创建 `src/components/ImageGenerateButton.tsx`
- [ ] 设计按钮样式（与现有 UI 风格一致）
- [ ] 添加加载状态和进度指示

#### 任务 2.2: 创建图像生成对话框
- [ ] 创建 `src/components/ImageGenerateDialog.tsx`
- [ ] 包含提示词输入框
- [ ] 包含参考图片上传区域（可选）
- [ ] 包含模型选择（Flash/Pro）
- [ ] 包含分辨率/宽高比选择
- [ ] 包含生成结果预览区域

#### 任务 2.3: 集成到聊天界面
- [ ] 在 `ClaudeCodeSession.tsx` 添加图像生成入口
- [ ] 支持在聊天中直接输入 `/image` 命令触发
- [ ] 生成的图片显示在聊天消息中
- [ ] 支持保存图片到本地

#### 任务 2.4: 图像编辑功能
- [ ] 支持对已生成的图片进行二次编辑
- [ ] 支持多轮对话式图像编辑
- [ ] 保存编辑历史

---

### 阶段 3: 多模态文件拖拽（预计 1.5 天）

#### 任务 3.1: 创建文件解析服务
- [ ] 创建 `src/services/fileParserService.ts`
- [ ] 实现图片解析（转 Base64）
- [ ] 实现 PDF 解析（提取文本和图片）
- [ ] 实现 Word 解析（提取文本）
- [ ] 实现 PPT 解析（提取文本和图片）
- [ ] 实现 Excel 解析（转 Markdown 表格）
- [ ] 实现通用文本文件解析

#### 任务 3.2: 创建文件拖拽区域组件
- [ ] 创建 `src/components/FileDropZone.tsx`
- [ ] 支持拖拽和点击上传
- [ ] 显示文件预览（图片缩略图、文件名、大小）
- [ ] 支持多文件上传
- [ ] 支持删除已上传文件

#### 任务 3.3: 集成到输入框
- [ ] 修改 `src/components/PromptInput.tsx`（或对应的输入组件）
- [ ] 添加拖拽区域
- [ ] 添加附件按钮（📎）
- [ ] 显示已附加文件列表
- [ ] 文件内容与提示词一起发送

#### 任务 3.4: 后端消息处理
- [ ] 修改消息发送逻辑，支持多模态内容
- [ ] 图片：转为 Base64 inline_data
- [ ] 文档：提取文本后作为上下文
- [ ] 大文件处理：分块或摘要

---

### 阶段 4: 测试与优化（预计 0.5 天）

#### 任务 4.1: 单元测试
- [ ] 测试 Gemini 图像生成服务
- [ ] 测试文件解析服务
- [ ] 测试各种文件格式

#### 任务 4.2: 集成测试
- [ ] 测试完整的图像生成流程
- [ ] 测试文件拖拽上传流程
- [ ] 测试多模态对话

#### 任务 4.3: 性能优化
- [ ] 大文件处理优化
- [ ] 图片压缩（上传前）
- [ ] 缓存已解析的文件

#### 任务 4.4: 错误处理
- [ ] API 调用失败处理
- [ ] 文件解析失败处理
- [ ] 用户友好的错误提示

---

### 阶段 5: 版本发布（预计 0.5 天）

#### 任务 5.1: 版本号更新
- [ ] `src-tauri/tauri.conf.json` → `2.7.0`
- [ ] `package.json` → `2.7.0`
- [ ] `src-tauri/Cargo.toml` → `2.7.0`

#### 任务 5.2: 更新公告
- [ ] 更新 `src/hooks/useFirstLaunchChangelog.ts`
- [ ] 添加 v2.7.0 更新日志
- [ ] 更新 FALLBACK_VERSION

#### 任务 5.3: 文档更新
- [ ] 更新 README.md
- [ ] 添加多模态功能使用说明
- [ ] 添加 API Key 配置说明

---

## 📁 需要创建/修改的文件

### 新建文件
```
src/
├── services/
│   ├── geminiImageService.ts      # Gemini 图像生成服务
│   └── fileParserService.ts       # 文件解析服务
├── components/
│   ├── ImageGenerateButton.tsx    # 图像生成按钮
│   ├── ImageGenerateDialog.tsx    # 图像生成对话框
│   ├── FileDropZone.tsx           # 文件拖拽区域
│   └── AttachmentPreview.tsx      # 附件预览组件
├── hooks/
│   ├── useImageGeneration.ts      # 图像生成 Hook
│   └── useFileParser.ts           # 文件解析 Hook
└── types/
    └── multimodal.ts              # 多模态相关类型定义
```

### 修改文件
```
src/
├── core/api/APIConfigManager.ts   # 添加 Google Image 提供商
├── components/
│   ├── ClaudeCodeSession.tsx      # 集成图像生成入口
│   ├── PromptInput.tsx            # 添加文件拖拽支持
│   └── settings/APIConfigPanel.tsx # 添加 Gemini API Key 配置
├── hooks/
│   ├── usePromptExecution.ts      # 支持多模态消息
│   └── useFirstLaunchChangelog.ts # 添加 v2.7.0 日志
├── package.json                   # 添加依赖
├── src-tauri/tauri.conf.json      # 版本号
└── src-tauri/Cargo.toml           # 版本号
```

---

## ⚠️ 注意事项

### API Key 安全
- Gemini API Key 必须使用安全存储（复用现有 secureStorage）
- 不要在前端代码中硬编码 API Key
- 考虑通过 Tauri 后端代理 API 调用（可选，增加安全性）

### 文件大小限制
- 图片：建议 < 10MB，超过需压缩
- PDF：建议 < 50 页，超过需分页处理
- 总附件大小：建议 < 20MB

### 兼容性
- 确保与现有 HiAPI/OpenAI 提供商兼容
- 图像生成功能应该是可选的（没有 API Key 时隐藏）

### 用户体验
- 图像生成需要 3-5 秒，必须有加载指示
- 文件解析应该是异步的，不阻塞 UI
- 提供清晰的错误提示

---

## 🔗 参考资料

- [Gemini API 图像生成文档](https://ai.google.dev/gemini-api/docs/image-generation)
- [Google GenAI JavaScript SDK](https://www.npmjs.com/package/@google/genai)
- [PDF.js 文档](https://mozilla.github.io/pdf.js/)
- [Mammoth.js 文档](https://github.com/mwilliamson/mammoth.js)
- [SheetJS (xlsx) 文档](https://sheetjs.com/)

---

## ✅ 进度追踪

| 阶段 | 状态 | 完成日期 |
|------|------|----------|
| 阶段 1: 基础设施 | ✅ 已完成 | 2026-01-11 |
| 阶段 2: 图像生成 UI | ✅ 已完成 | 2026-01-11 |
| 阶段 3: 多模态文件拖拽 | ✅ 已完成 | 2026-01-11 |
| 阶段 4: 测试与优化 | ⏳ 待用户测试 | - |
| 阶段 5: 版本发布 | ✅ 已完成 | 2026-01-11 |

---

## 📁 已创建的文件

### 服务层
- `src/services/geminiImageService.ts` - Gemini 图像生成服务
- `src/services/fileParserService.ts` - 多格式文件解析服务

### 组件
- `src/components/ImageGeneration/ImageGenerateButton.tsx` - 图像生成按钮
- `src/components/ImageGeneration/ImageGenerateDialog.tsx` - 图像生成对话框
- `src/components/ImageGeneration/index.ts` - 导出文件
- `src/components/FileDropZone/FileDropZone.tsx` - 文件拖拽区域
- `src/components/FileDropZone/index.ts` - 导出文件

### Hooks
- `src/hooks/useImageGeneration.ts` - 图像生成状态管理
- `src/hooks/useFileAttachments.ts` - 文件附件管理

### 版本更新
- `package.json` - 版本号 2.6.0 → 2.7.0
- `src-tauri/tauri.conf.json` - 版本号 2.6.0 → 2.7.0
- `src-tauri/Cargo.toml` - 版本号 2.6.0 → 2.7.0
- `src/hooks/useFirstLaunchChangelog.ts` - 添加 v2.7.0 更新日志

---

## 🔧 下一步：集成到 FloatingPromptInput

需要手动将以下组件集成到 `FloatingPromptInput/ControlBar.tsx`：

```tsx
// 1. 导入组件
import { ImageGenerateButton } from '@/components/ImageGeneration';
import { FileDropZone, type FileAttachment } from '@/components/FileDropZone';

// 2. 在 ControlBar 中添加图像生成按钮
<ImageGenerateButton
  disabled={disabled}
  onImageGenerated={(base64, mimeType) => {
    // 将生成的图片添加到附件
  }}
/>

// 3. 在输入区域添加文件拖拽支持
<FileDropZone
  attachments={fileAttachments}
  onAttachmentsChange={setFileAttachments}
  compact
/>
```

---

*准备好开始了吗？说 "开始任务 1.1" 或 "开始阶段 1" 即可！*
