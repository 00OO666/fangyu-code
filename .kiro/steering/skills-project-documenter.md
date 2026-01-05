---
inclusion: manual
---

# Project Documenter - 项目代码文档生成器

> 从 Claude Code Skills 迁移

## 触发词
- "生成项目文档"、"generate project documentation"
- "文档化项目"、"document project"
- "生成readme"、"generate readme"
- "项目结构文档"、"project structure documentation"
- "代码索引"、"code index"
- "组件索引"、"component index"

## 核心目标
1. **看图定位** - 用户截图问"这个功能在哪"，能立即找到对应代码
2. **全面索引** - 每个目录都有 README，每个文件都有用途说明
3. **UI 映射** - 组件、页面、功能与文件路径的对应关系
4. **快速修改** - 知道改什么功能要动哪些文件

## 项目类型识别

| 特征文件 | 项目类型 | 文档重点 |
|---------|---------|---------|
| `package.json` + `src/` | React/Vue/Node | 组件树、路由、状态管理 |
| `Cargo.toml` | Rust | Crate、模块、trait |
| `composer.json` | PHP | 控制器、模型、视图 |
| `Tauri.toml` + `src-tauri/` | Tauri | 前端组件 + Rust 命令 |

## 文档结构

```
project/
├── _README.md              # 项目总览（必须）
├── _COMPONENT_INDEX.md     # UI组件索引（前端项目）
├── _FUNCTION_INDEX.md      # 功能模块索引
├── src/
│   ├── _README.md          # src 目录说明
│   ├── components/
│   │   └── _README.md      # 组件目录说明
│   └── pages/
│       └── _README.md      # 页面目录说明
```

## 项目总览模板 (_README.md)

```markdown
# 项目名称

## 快速定位指南

| 我想要... | 去这里找 |
|-----------|---------|
| 修改顶部导航 | `src/components/Header/` |
| 修改登录逻辑 | `src/pages/Login/` + `src/api/auth.ts` |
| 添加新页面 | `src/pages/` 创建目录 + `src/router/` 添加路由 |
| 修改全局样式 | `src/styles/global.css` |
| 修改 API 地址 | `src/config/api.ts` |

## 项目结构

src/
├── components/     # 可复用组件
├── pages/          # 页面组件
├── hooks/          # 自定义 Hooks
├── utils/          # 工具函数
├── api/            # API 请求封装
├── stores/         # 状态管理
├── styles/         # 全局样式
└── types/          # TypeScript 类型定义

## 技术栈
- 框架：[React/Vue/...]
- UI库：[Ant Design/Element Plus/...]
- 状态管理：[Redux/Zustand/Pinia/...]
```

## 组件索引模板 (_COMPONENT_INDEX.md)

```markdown
# UI 组件索引

## 布局组件

| 组件名 | 路径 | 用途 | 截图描述 |
|-------|------|------|---------|
| Header | `src/components/Header/` | 顶部导航栏 | 页面最顶部，包含 Logo、菜单、用户头像 |
| Sidebar | `src/components/Sidebar/` | 侧边栏导航 | 页面左侧，包含菜单列表 |
| Footer | `src/components/Footer/` | 页脚 | 页面底部，包含版权信息 |

## 视觉定位

┌─────────────────────────────────────────┐
│ Header (src/components/Header/)         │
├───────────┬─────────────────────────────┤
│           │                             │
│ Sidebar   │   Main Content              │
│           │   (src/pages/*)             │
│           │                             │
├───────────┴─────────────────────────────┤
│ Footer (src/components/Footer/)         │
└─────────────────────────────────────────┘
```

## 功能索引模板 (_FUNCTION_INDEX.md)

```markdown
# 功能模块索引

## 用户相关

| 功能 | 主要文件 | 相关组件 | API |
|------|---------|---------|-----|
| 用户登录 | `src/pages/Login/` | LoginForm | `POST /api/login` |
| 用户注册 | `src/pages/Register/` | RegisterForm | `POST /api/register` |
| 退出登录 | `src/components/Header/` | UserMenu | `POST /api/logout` |

## 常见修改场景

### "我想在表格里加一列"
1. 找到表格组件：`src/components/DataTable/`
2. 修改列配置：`columns` 数组
3. 如需新数据，修改 API 调用
```

## 注意事项
1. **不覆盖已有文件** - 如果 `_README.md` 已存在，先确认是否覆盖
2. **忽略 node_modules** - 不处理依赖目录
3. **忽略 dist/build** - 不处理构建产物
4. **保持更新** - 代码变化时提醒更新文档
