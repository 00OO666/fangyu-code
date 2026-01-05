---
inclusion: manual
---

# Config Doctor - 配置诊断专家

> 从 Claude Code Skills 迁移（适用于 Claude Code，Kiro 可参考思路）

## 触发词
- "Token消耗过快"、"token consumption"
- "配置诊断"、"config diagnosis"
- "配置同步问题"、"config sync issue"
- "优化配置"、"optimize config"
- "检查配置"、"check config"

## 核心能力
- **配置文件分析** - 检查配置文件大小和内容结构
- **MCP/Skills检查** - 诊断 MCP 服务器和 Skills 配置状态
- **历史数据清理** - 识别可清理的历史数据和缓存
- **项目目录优化** - 分析项目目录结构和配置同步
- **干净模板生成** - 生成优化后的项目配置模板

## 诊断流程

### 步骤 1: 快速体检
```powershell
# 检查 .claude 目录大小 (Claude Code)
Get-ChildItem -Path "$env:USERPROFILE\.claude" -Recurse | Measure-Object -Property Length -Sum

# 检查 .kiro 目录大小 (Kiro)
Get-ChildItem -Path ".kiro" -Recurse | Measure-Object -Property Length -Sum
```

### 步骤 2: 深度扫描

#### 分析 projects 目录（最常见的性能杀手）
- ✅ 正常：单个项目目录 < 5MB
- ⚠️ 警告：单个项目目录 5-20MB
- 🚨 严重：单个项目目录 > 20MB

#### MCP 配置审计
检查点：
1. 全局配置中是否有未使用的 MCP 仍启用？
2. 项目级配置是否正确覆盖了全局配置？
3. 是否有 MCP 在 UI 中显示禁用，但实际仍在配置文件中？

#### Steering 文件分析
- ✅ 正常：总 Steering 目录 < 500KB，单个文件 < 20KB
- ⚠️ 警告：总 Steering 目录 500KB-2MB
- 🚨 严重：总 Steering 目录 > 2MB 或单个文件 > 100KB

## 配置健康标准

### Kiro 配置
- [ ] 全局 steering 文件 < 5KB
- [ ] 项目级 steering 文件 < 2KB
- [ ] 活跃 MCP servers < 3 个
- [ ] Steering 文件数量合理

### 最佳实践
1. **按需启用 MCP** - 默认禁用，需要时再启用
2. **Steering 分层** - 全局规则 + 项目规则分离
3. **定期清理** - 删除不再使用的配置
4. **模块化** - 大型配置拆分为多个文件

## 优化建议

### 立即执行
1. 禁用未使用的 MCP
2. 压缩过大的 steering 文件
3. 清理历史数据

### 长期维护
1. 定期检查配置健康度
2. 使用项目级配置覆盖全局配置
3. 将大型文档移至独立文件

## Kiro 配置文件位置
- **Steering**: `.kiro/steering/*.md`
- **Hooks**: `.kiro/hooks/`
- **Specs**: `.kiro/specs/`
- **MCP**: `~/.kiro/settings/mcp.json`
