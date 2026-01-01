const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/hooks/useFirstLaunchChangelog.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newEntry = `  '2.0.0': {
    title: 'v2.0.0 - 🚀 聊天历史回溯系统 + 语义搜索',
    date: '2026-01-02',
    features: [
      '📚 聊天历史回溯系统 - 再也不会忘记"上次让你弄的那个功能"了！',
      '🔍 FTS5 全文搜索 - 输入模糊关键词，找到相关历史对话',
      '💾 自动保存聊天记录 - 所有对话自动存储到本地 SQLite 数据库',
      '📊 历史统计面板 - 查看总消息数、会话数、Token 消耗统计',
      '🎯 智能工具推荐 - 根据对话内容自动推荐 MCP/SKILL/Hook',
      '📈 工具使用统计 - 记录每个工具的使用频率，智能排序',
      '🔄 MCP 配置实时同步 - .claude.json ↔ settings.json 双向同步',
    ],
    improvements: [
      '搜索面板智能排序 - 已启用优先 > 使用频率(70%) + 时间衰减(30%)',
      '历史搜索面板 - 支持关键词高亮、时间筛选、上下文加载',
      'SQLite 性能优化 - WAL 模式 + 6 项索引优化',
      'Phase 2 预留 - 向量语义搜索（OpenAI/Ollama embedding）',
    ],
    bugFixes: [
      '修复 MCP 开启后切换会话显示关闭的问题',
      '修复搜索排序未生效的问题',
    ],
  },
`;

// 在 '1.5.2' 之前插入新条目
content = content.replace(
  /export const CHANGELOGS = \{\n  '1\.5\.2'/,
  `export const CHANGELOGS = {\n${newEntry}  '1.5.2'`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Changelog updated with v2.0.0 entry');
