# Fangyu Code Skills 系统

> 灵感来源：Claude Code Skills

## 📖 概述

Skills 系统让 Fangyu Code 能够根据用户输入自动匹配和激活预定义的工作流程，提供更智能的辅助。

## 🗂️ 目录结构

```
~/.fangyu-code/skills/          # 全局 Skills（用户级）
├── task-planner/
│   └── SKILL.md
├── smart-debug/
│   └── SKILL.md
└── ...

.fangyu/skills/                  # 项目 Skills（项目级，优先级更高）
├── project-specific/
│   └── SKILL.md
└── ...
```

## 📝 SKILL.md 格式

```markdown
---
name: skill-name
description: |
  Skill 描述。说明功能和触发条件。
  当用户说"xxx"、"yyy"时触发。
license: Apache-2.0
compatibility: Fangyu Code 2.4+
metadata:
  author: Your Name
  version: 1.0.0
  categories:
    - category1
    - category2
  keywords:
    - keyword1
    - keyword2
---

# Skill 标题

## 概述
[功能描述]

## 触发条件
[触发关键词列表]

## 工作流程
### 步骤 1: xxx
[指令]

### 步骤 2: xxx
[指令]

## 注意事项
[重要提醒]
```

## 🎯 三种模式

### 1. Workflow 模式
适用于有明确步骤的流程：
- 任务规划
- 代码审查
- 部署流程

### 2. Task 模式
适用于工具集合：
- 调试助手
- 代码生成
- 文档生成

### 3. Reference 模式
适用于规范和标准：
- 编码规范
- API 文档
- 最佳实践

## 🔧 使用方式

### 自动触发
输入包含触发词时自动匹配：
```
用户: 帮我规划一下这个功能
→ 自动激活 task-planner Skill
```

### 手动选择
在 Skills 面板中选择并激活。

### API 调用
```typescript
import { useSkills } from '@/hooks/useSkills';

const { matchInput, generatePrompt } = useSkills();

// 匹配 Skill
const matches = await matchInput('帮我调试这个问题');

// 生成 Prompt 注入
if (matches.length > 0) {
  const prompt = generatePrompt(matches[0].skill);
  // 将 prompt 注入到 AI 对话中
}
```

## 📦 内置 Skills

| Skill | 触发词 | 用途 |
|-------|--------|------|
| task-planner | 规划、拆解、计划 | 任务规划 |
| smart-debug | 调试、报错、诊断 | 智能调试 |

## 🛠️ 创建自定义 Skill

1. 在 `~/.fangyu-code/skills/` 创建目录
2. 创建 `SKILL.md` 文件
3. 按格式编写内容
4. 重启或刷新 Skills 面板

## 🔗 与 Spec 模式集成

Skills 可以与 Spec 模式配合使用：
- Skill 提供工作流程指导
- Spec 提供具体的需求文档
- 两者结合实现更精准的开发辅助

## 📚 参考

- [Claude Code Skills 文档](https://docs.anthropic.com/claude-code/skills)
- [Kiro Steering 文件](https://kiro.dev/docs/steering)
