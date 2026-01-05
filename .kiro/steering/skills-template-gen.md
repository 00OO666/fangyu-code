---
inclusion: manual
---

# Template Gen - PbootCMS 模板生成器

> 从 Claude Code Skills 迁移

## 触发词
- "生成模板"、"generate template"
- "创建页面"、"create page"
- "模板开发"、"template development"
- "列表页"、"list page"
- "详情页"、"detail page"
- "表单页"、"form page"

## 核心能力
- **快速生成** - 一键生成列表页、详情页、单页、表单页模板
- **SEO 优化** - 自动包含 meta 标签、面包屑导航、结构化数据
- **响应式设计** - 移动端适配的 HTML 结构和 CSS 类名
- **PbootCMS 标签** - 完整的标签使用示例和参数说明

## 模板类型

### 1. 列表页模板（新闻列表/产品列表）

```html
<!DOCTYPE html>
<html lang="{pboot:sitelang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{pboot:pagetitle}</title>
    <meta name="keywords" content="{pboot:pagekeywords}">
    <meta name="description" content="{pboot:pagedescription}">
</head>
<body>
    {include file=comm/head.html}

    <!-- 面包屑导航 -->
    <nav class="breadcrumb">
        <a href="{pboot:home}">首页</a> &gt;
        <span>{pboot:sorttitle}</span>
    </nav>

    <!-- 列表内容 -->
    <section class="list-container">
        <h1>{pboot:sorttitle}</h1>
        <div class="article-list">
            {pboot:list num=10}
            <article class="article-item">
                <h2><a href="[list:link]">[list:title]</a></h2>
                <div class="meta">
                    <span class="date">[list:date style=Y-m-d]</span>
                </div>
                <p class="desc">[list:description len=200]</p>
            </article>
            {/pboot:list}
        </div>
        <div class="pagination">{pboot:page}</div>
    </section>

    {include file=comm/foot.html}
</body>
</html>
```

### 2. 详情页模板

```html
<article class="content-detail">
    <header>
        <h1>{content:title}</h1>
        <div class="meta">
            <span class="date">{content:date style=Y-m-d}</span>
            <span class="views">浏览: {content:visits} 次</span>
        </div>
    </header>
    <div class="content-body">{content:content}</div>
    
    <!-- 上一篇/下一篇 -->
    <nav class="post-nav">
        <div class="prev-post">
            上一篇: {content:precontent}<a href="[content:link]">[content:title]</a>{/content:precontent}
        </div>
        <div class="next-post">
            下一篇: {content:nextcontent}<a href="[content:link]">[content:title]</a>{/content:nextcontent}
        </div>
    </nav>
</article>
```

### 3. 表单页模板

```html
<form action="{pboot:form fcode=1}" method="post" id="inquiry-form">
    <div class="form-group">
        <label for="name">姓名 <span class="required">*</span></label>
        <input type="text" id="name" name="name" required>
    </div>
    <div class="form-group">
        <label for="tel">电话 <span class="required">*</span></label>
        <input type="tel" id="tel" name="tel" required>
    </div>
    <div class="form-group">
        <label for="message">咨询内容</label>
        <textarea id="message" name="message" rows="5"></textarea>
    </div>
    <button type="submit" class="btn-submit">提交</button>
</form>
```

## 常用 PbootCMS 标签速查

### 站点信息
- `{pboot:sitename}` - 网站名称
- `{pboot:siteurl}` - 网站URL
- `{pboot:siteemail}` - 站点邮箱
- `{pboot:sitetelephone}` - 站点电话

### 列表标签
```
{pboot:list num=10 order=date}
[list:title] - 标题
[list:link] - 链接
[list:date style=Y-m-d] - 日期
[list:description len=100] - 描述
{/pboot:list}
```

### 内容标签
```
{content:title} - 标题
{content:content} - 内容
{content:date} - 日期
{content:visits} - 访问量
```

## 生成步骤
1. **确定页面类型**：列表/详情/单页/表单
2. **复制对应模板**到 `template/default/htmls/`
3. **修改标签参数**：如 `num`、`order`、`fcode` 等
4. **调整样式**：根据需求修改 CSS 类名
5. **部署**：清除 runtime 缓存

## 注意事项
- 所有模板都包含 SEO 元数据
- 面包屑导航提升用户体验
- 表单需要配置表单码 `fcode`
- 修改后必须清除 runtime 缓存
