---
inclusion: manual
---

# Chrome Debug - 浏览器调试工具

> 从 Claude Code Skills 迁移

## 触发词
- "调试网站"、"debug website"
- "截图验证"、"screenshot"
- "浏览器测试"、"browser test"
- "性能分析"、"performance analysis"
- "网站测试"、"website testing"

## 核心能力
通过 chrome-devtools MCP 或 puppeteer MCP 实现：
- 页面导航和截图
- DOM 结构获取
- 页面交互（点击、填写表单）
- 网络请求监控
- 控制台日志查看

## 主要功能

### 1. 页面导航
打开指定网址进行测试

### 2. 页面截图
截取当前页面或特定元素

### 3. DOM 结构获取
获取页面 DOM 结构，用于分析页面元素

### 4. 页面交互
- 点击元素
- 填写表单
- 选择下拉框
- 输入文本

### 5. 网络请求监控
查看页面加载的所有网络请求

### 6. 控制台日志
查看浏览器控制台的所有消息

## 常用场景

### 场景 1: PbootCMS 网站修改后验证
1. 修改 PbootCMS 模板文件
2. 使用 puppeteer MCP 打开网站
3. 截图验证效果

### 场景 2: 表单测试
1. 打开表单页面
2. 自动填写表单
3. 提交并验证结果

### 场景 3: 性能调试
1. 打开页面
2. 查看网络请求
3. 分析加载时间

### 场景 4: 响应式测试
1. 设置不同的视口大小
2. 截图对比

## 使用规则

> **网站调试**：修改网站代码后，用 puppeteer MCP 打开网站截图验证效果

**执行时机**：
- 修改 PbootCMS 模板后
- 修改 CSS 样式后
- 修改 JavaScript 后
- 任何前端代码变更后

**标准流程**：
1. 修改代码
2. 部署/清缓存
3. 使用 MCP 打开并截图
4. 验证效果是否符合预期

## MCP 配置

需要在 `~/.kiro/settings/mcp.json` 中启用 puppeteer MCP：

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/puppeteer-mcp"],
      "disabled": false
    }
  }
}
```

## 注意事项
1. **MCP 连接** - 使用前确保 MCP 已连接
2. **页面加载** - 等待页面完全加载后再截图或交互
3. **选择器准确性** - 使用正确的 CSS 选择器
4. **网络环境** - 确保能访问目标网站
