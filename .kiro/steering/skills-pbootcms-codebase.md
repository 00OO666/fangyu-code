---
inclusion: manual
---

# PbootCMS Codebase - 代码库智能定位

> 从 Claude Code Skills 迁移

## 触发词
- "修改 xxx"、"改 xxx"
- "找到 xxx 文件"、"定位 xxx"
- "xxx 在哪"、"xxx 文件在哪里"
- "修改首页"、"修改导航"、"修改产品"
- "修改询盘"、"修改翻译"、"修改移动端"

## 核心价值
1秒内准确定位需要修改的文件，消除重复搜索，提高开发效率。

## 关键词智能匹配

| 用户说... | 自动定位到... |
|-----------|---------------|
| "修改首页" | `htmls/index.html`, `hero_banner.html` |
| "修改导航" | `htmls/head.html`, `css/nav-glassmorphism.css` |
| "修改产品列表" | `htmls/productlist.html`, `css/category-showcase.css` |
| "修改产品详情" | `htmls/product.html`, `css/product-detail-enhanced.css` |
| "修改翻译" | `js/translate-lang.js`, `css/translate-lang.css` |
| "修改询盘表单" | `inquiry-handler.php`, `htmls/inquiry-form-module.html` |
| "修改移动端" | `css/responsive-unified.css`, `css/mobile-bottom-nav-enhanced.css` |
| "修改后台" | `oskj_admin.php`, `apps/admin/view/` |

## PbootCMS 目录结构

```
/www/wwwroot/8.136.42.225/
├── template/default/
│   ├── htmls/           # 模板文件
│   │   ├── index.html   # 首页
│   │   ├── head.html    # 头部
│   │   ├── foot.html    # 底部
│   │   ├── productlist.html  # 产品列表
│   │   └── product.html      # 产品详情
│   └── images/          # 模板图片
├── static/
│   ├── css/             # 样式文件
│   └── js/              # 脚本文件
├── config/              # 配置文件
├── apps/                # 应用目录
│   ├── admin/           # 后台
│   └── home/            # 前台
└── runtime/             # 缓存目录
```

## PbootCMS 标签速查

### 常用标签定位

| 标签 | 用途 | 常见位置 |
|------|------|----------|
| `{pboot:nav}` | 导航/分类遍历 | head.html, index.html |
| `{pboot:list}` | 内容列表 | productlist.html, newslist.html |
| `{pboot:sort}` | 栏目信息 | 各页面获取栏目名 |
| `{pboot:content}` | 内容详情 | product.html, news.html |
| `{include file=}` | 包含模板 | index.html 等主模板 |

### 搜索标签用法
```
grepSearch: query="{pboot:nav" includePattern="**/*.html"
grepSearch: query="{pboot:list" includePattern="**/*.html"
```

## 常见场景速查表

| 场景 | 主要文件 | 辅助文件 |
|------|---------|---------|
| 🏠 首页修改 | index.html | hero_banner.html, about-section.html |
| 🧭 导航栏 | head.html | nav-glassmorphism.css |
| 👣 页脚 | foot.html | style.css (.footer) |
| 📦 产品列表 | productlist.html | category-showcase.css, product-card-v4.css |
| 📋 产品详情 | product.html | product-detail-enhanced.css |
| 📝 询盘表单 | inquiry-handler.php | inquiry-form-module.html |
| 🌐 多语言 | translate-lang.js | translate-lang.css |
| 📱 移动端 | responsive-unified.css | mobile-bottom-nav-enhanced.css |
| 🔐 后台管理 | oskj_admin.php | apps/admin/view/ |

## 工作流程

```
用户请求: "修改产品列表页的样式"
        │
        ▼
1. 关键词提取: "产品列表", "样式"
        │
        ▼
2. 匹配文件:
   - productlist.html (模板)
   - category-showcase.css (样式)
   - product-card-v4.css (卡片)
        │
        ▼
3. 输出定位结果 (带完整路径)
        │
        ▼
4. 读取相关文件并分析结构
```

## 修改后操作提醒

```
✅ 文件已修改

⚠️ 下一步操作:
   1. SSH 到服务器清缓存: rm -rf runtime/*
   2. 或执行完整部署命令
   3. 浏览器 Ctrl+F5 强制刷新

💡 小提示: 修改 CSS/JS 记得更新版本号参数 ?v=xxx
```

## 服务器信息
- **IP**: 8.136.42.225
- **SSH**: `ssh root@8.136.42.225`
- **网站根目录**: `/www/wwwroot/8.136.42.225/`
- **模板目录**: `/www/wwwroot/8.136.42.225/template/default/`
