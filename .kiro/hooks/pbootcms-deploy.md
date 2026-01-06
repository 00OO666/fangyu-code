---
name: pbootcms-deploy
version: 1.0.0
triggers:
  - type: manual
    title: "🚀 部署 PbootCMS 网站"
agent:
  prompt: |
    用户请求部署 PbootCMS 网站 (8.136.42.225)。执行以下标准部署流程：

    ## 部署步骤

    1. **清除 PbootCMS 缓存**
       ```bash
       ssh root@8.136.42.225 "rm -rf /www/wwwroot/8.136.42.225/runtime/cache/* /www/wwwroot/8.136.42.225/runtime/complile/*"
       ```

    2. **更新 CSS/JS 版本号**（如果修改了静态资源）
       - 检查 head.html 中的版本号参数
       - 将修改过的 CSS/JS 文件版本号更新为当前时间戳

    3. **截图验证**
       - 使用 puppeteer 访问 http://8.136.42.225/?t={timestamp}
       - 截图确认更改已生效

    4. **报告结果**
       - 告知用户部署完成
       - 如果有问题，提供排查建议

    ## 注意事项
    - Nginx 缓存周期：图片 30 天，JS/CSS 7 天
    - 如果更改未生效，需要更新文件的版本号参数 (?v=xxx)
    - PbootCMS 缓存目录：/runtime/cache/ 和 /runtime/complile/
---

# PbootCMS 网站部署 Hook

点击触发后，自动执行网站部署流程：
- 清除服务器缓存
- 更新静态资源版本号
- 截图验证更改

适用于 8.136.42.225 上的 Fangyu Machine 外贸网站。
