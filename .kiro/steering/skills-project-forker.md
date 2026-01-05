---
inclusion: manual
---

# Project Forker - 一键 Fork 并定制 GitHub 项目

> 从 Claude Code Skills 迁移

## 触发词
- "fork 这个项目"、"克隆这个项目到本地"
- "把 xxx 项目变成我自己的"
- "帮我定制 xxx 项目"
- "copy 这个 GitHub 项目"

## 核心能力
- **智能克隆** - 克隆任意 GitHub 项目到本地
- **自动识别** - 识别项目类型和技术栈
- **改名换姓** - 修改所有标识符和品牌元素
- **配置修复** - 自动修复常见配置问题
- **编译打包** - 生成可安装的应用程序

## 执行流程

### Phase 1: 信息收集
```
必需信息：
1. GitHub 仓库 URL
2. 本地目标路径（默认：F:\{新项目名}-Dev）
3. 新项目名称（英文，如 "my-app"）
4. 显示名称（中文，如 "我的应用"）
5. 作者名称
6. 图标路径（可选）
```

### Phase 2: 环境检查
```powershell
node --version    # Node.js 18+
npm --version     # npm 9+
rustc --version   # Rust（Tauri 项目需要）
git --version     # Git
```

### Phase 3: 克隆项目
```powershell
git clone {GITHUB_URL} {LOCAL_PATH}
cd {LOCAL_PATH}
npm install
```

### Phase 4: 识别项目类型

| 文件 | 项目类型 |
|------|----------|
| `src-tauri/tauri.conf.json` | Tauri 应用 |
| `electron.js` 或 `electron/` | Electron 应用 |
| `package.json` 含 "react/vue" | 纯前端项目 |
| `Cargo.toml`（无 tauri） | 纯 Rust 项目 |

### Phase 5: 执行定制

#### Tauri 项目修改清单

| 文件 | 修改内容 |
|------|----------|
| `src-tauri/Cargo.toml` | name, version, description, authors |
| `src-tauri/tauri.conf.json` | productName, identifier, version, window.title |
| `package.json` | name, version, description, author |
| `src-tauri/icons/*` | 替换所有图标文件 |

#### 关键配置修复（Tauri）
```json
{
  "app": {
    "windows": [{ "visible": true }]
  },
  "plugins": {
    "updater": {
      "active": false,
      "pubkey": ""
    }
  },
  "bundle": {
    "createUpdaterArtifacts": false,
    "targets": ["nsis"]
  }
}
```

### Phase 6: 编译构建
```powershell
npm run build
npx tauri build  # Tauri 项目
```

### Phase 7: 测试运行
```powershell
& "{PROJECT_PATH}\src-tauri\target\release\{PROJECT_NAME}.exe"
```

## 常见错误自动修复

| 错误 | 自动修复方案 |
|------|-------------|
| `link.exe not found` | 安装 VS Build Tools |
| `cargo not found` | 安装 Rust |
| `missing field 'pubkey'` | 添加 `"pubkey": ""` |
| `visible: false` 导致无窗口 | 改为 `true` |
| WiX 下载超时 | 改用 `targets: ["nsis"]` |

## 注意事项
1. **不要让用户手动操作** - 所有步骤都自动完成
2. **不要分步询问** - 收集完信息后一气呵成
3. **遇到错误立即修复** - 不要停下来问用户
4. **测试到能运行为止** - 不能只编译不测试
5. **保留构建脚本** - 方便用户以后自己构建
