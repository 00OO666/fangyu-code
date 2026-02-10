# 上游同步报告

**生成时间**: 2026-02-09
**上游项目**: Any Code (claude-workbench)
**上游仓库**: https://github.com/anyme123/any-code

---

## 📊 版本对比

| 项目 | 当前版本 | 上游版本 | 差距 |
|------|---------|---------|------|
| **Fangyu Code** | v3.0.0 | - | - |
| **Any Code** | - | v5.18.6 | 🔴 落后 |

---

## 🆕 上游最新更新 (v5.17.5 → v5.18.6)

### v5.18.6 (最新)
- chore: bump version to v5.18.6

### v5.18.0
- **feat**: 为三个引擎的代理商管理页面添加拖拽排序功能
- **fix**: 修复Codex和Gemini代理商管理页面相同API地址不同apikey无法切换的问题
- **fix**: 修复代理商管理页面相同API地址不同apikey无法切换的问题
- **fix**: 修复MCP工具调用结果中长文本不换行的问题
- **fix**: 修复MCP工具执行结果数组格式内容不显示文本的问题

### v5.17.5
- **fix**: 修复通过+号新建会话时提示词丢失的问题
- **fix**: 修复多个编辑器组件中的 i18n 硬编码字符串问题
- **fix**: 读取Claude Code项目目录异常
- **fix**: 修复标签页右键菜单在Tauri中被系统菜单覆盖的问题
- **feat**: 为标签页添加右键菜单功能
- **refactor**: simplify file reading logic in project_store.rs

---

## 🔒 安全审计结果

### 发现的漏洞

**总计**: 10 个漏洞
- 🟢 Low: 1 个
- 🟡 Moderate: 8 个
- 🔴 High: 1 个

### 详细漏洞列表

#### 1. diff (6.0.0 - 8.0.2)
- **严重性**: Moderate
- **问题**: Denial of Service vulnerability in parsePatch and applyPatch
- **修复**: `npm audit fix`

#### 2. esbuild (<=0.24.2)
- **严重性**: Moderate
- **问题**: enables any website to send any requests to the development server
- **修复**: `npm audit fix --force` (breaking change)

#### 3. lodash (4.0.0 - 4.17.21)
- **严重性**: Moderate
- **问题**: Prototype Pollution Vulnerability in `_.unset` and `_.omit`
- **修复**: `npm audit fix`

#### 4. xlsx (*)
- **严重性**: High
- **问题**:
  - Prototype Pollution in sheetJS
  - Regular Expression Denial of Service (ReDoS)
- **修复**: No fix available (需要更换依赖)

---

## 📦 过时的依赖

### 关键依赖更新

| 包名 | 当前版本 | 最新版本 | 类型 |
|------|---------|---------|------|
| **@anthropic-ai/claude-agent-sdk** | 0.2.2 | 0.2.37 | 🔴 Major |
| **@anthropic-ai/sdk** | 0.71.2 | 0.74.0 | 🟡 Minor |
| **@google/genai** | 1.35.0 | 1.40.0 | 🟡 Minor |
| **@tauri-apps/api** | 2.9.1 | 2.10.1 | 🟡 Minor |
| **@tauri-apps/cli** | 2.9.6 | 2.10.0 | 🟡 Minor |
| **react** | 18.3.1 | 19.2.4 | 🔴 Major |
| **react-dom** | 18.3.1 | 19.2.4 | 🔴 Major |
| **vite** | 6.4.1 | 7.3.1 | 🔴 Major |
| **vitest** | 2.1.9 | 4.0.18 | 🔴 Major |

### 其他过时依赖 (35+ 个)

详见 `npm outdated` 输出。

---

## 🎯 建议的行动

### 立即行动 (本周)

1. **修复安全漏洞**
   ```bash
   npm audit fix
   ```

2. **评估 xlsx 依赖**
   - 检查是否真的需要 xlsx
   - 如果需要，考虑替代方案（如 exceljs）

3. **更新关键依赖**
   ```bash
   npm update @anthropic-ai/claude-agent-sdk
   npm update @anthropic-ai/sdk
   npm update @google/genai
   npm update @tauri-apps/api
   npm update @tauri-apps/cli
   ```

### 短期行动 (1-2 周)

1. **评估上游更新**
   - 查看 v5.17.5 → v5.18.6 的更新
   - 选择性合并有价值的功能
   - 特别关注：
     - 代理商管理页面的拖拽排序
     - API key 切换问题修复
     - MCP 工具调用结果显示修复

2. **测试 Major 版本更新**
   - React 19 (breaking change)
   - Vite 7 (breaking change)
   - Vitest 4 (breaking change)

### 中期行动 (1-2 个月)

1. **建立定期同步机制**
   - 每月检查上游更新
   - 评估并合并有价值的更新

2. **建立 CI/CD**
   - 自动化安全审计
   - 自动化依赖更新检查

---

## 📝 上游跟踪配置

已成功配置上游跟踪：

```bash
git remote add upstream https://github.com/anyme123/any-code.git
git fetch upstream
```

**上游分支**：
- upstream/main
- upstream/feature/codex-integration
- upstream/performance-optimization-backup
- upstream/stable-recovery-point

**上游标签**：
- v5.18.6 (最新)
- v5.18.0
- v5.17.5

---

## 🔄 同步命令参考

### 查看上游更新
```bash
git log upstream/main --oneline -20
git diff upstream/main
```

### 合并上游更新
```bash
# 方法 1: Merge (保留完整历史)
git merge upstream/main

# 方法 2: Rebase (线性历史)
git rebase upstream/main

# 方法 3: Cherry-pick (选择性合并)
git cherry-pick <commit-hash>
```

### 查看差异
```bash
# 查看文件差异
git diff upstream/main -- <file-path>

# 查看提交差异
git log --oneline --graph --decorate --all
```

---

**生成者**: Claude Opus 4.6 (1M context)
**最后更新**: 2026-02-09
