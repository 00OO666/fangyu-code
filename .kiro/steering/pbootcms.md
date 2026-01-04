---
inclusion: manual
---

# PbootCMS 项目指南

## 服务器信息
- 服务器 IP: 8.136.42.225
- 用户: root
- 网站目录: `/www/wwwroot/8.136.42.225/`
- 模板目录: `template/default/htmls/`
- 静态资源: `static/`

## 常用 SSH 命令

### 连接服务器
```bash
ssh root@8.136.42.225
```

### 一键智能诊断
```bash
ssh root@8.136.42.225 "
echo '========================================'
echo '     PbootCMS 智能诊断报告              '
echo '========================================'

# HTTP 健康检查
HTTP_CODE=\$(curl -s -o /tmp/test.html -w '%{http_code}' --connect-timeout 5 http://localhost/)
HTTP_SIZE=\$(wc -c < /tmp/test.html 2>/dev/null || echo 0)
echo \"状态码: \$HTTP_CODE, 响应大小: \$HTTP_SIZE bytes\"

# 服务状态
for svc in nginx php-fpm-81 mysqld; do
    if systemctl is-active \$svc >/dev/null 2>&1; then
        echo \"[OK] \$svc\"
    else
        echo \"[FAIL] \$svc (未运行)\"
    fi
done
"
```

### 快速修复命令
```bash
# 一键修复常见问题 (权限 + 缓存 + 重启)
ssh root@8.136.42.225 "chown -R www:www /www/wwwroot/8.136.42.225 && rm -rf /www/wwwroot/8.136.42.225/runtime/* && systemctl restart nginx php-fpm-81"
```

### 清理缓存
```bash
ssh root@8.136.42.225 "rm -rf /www/wwwroot/8.136.42.225/runtime/*"
```

## 问题诊断表

| 症状 | 可能原因 | 修复方案 |
|------|---------|---------|
| HTTP 502 | PHP-FPM 崩溃 | `systemctl restart php-fpm-81` |
| HTTP 403 | 文件权限错误 | `chown -R www:www /www/wwwroot/8.136.42.225` |
| 响应<100字节 | 模板缓存问题 | `rm -rf /www/wwwroot/8.136.42.225/runtime/*` |
| 内存>85% | 内存不足 | 清理进程或重启服务 |

## 文件上传
```bash
# 上传文件到服务器
scp local_file.txt root@8.136.42.225:/www/wwwroot/8.136.42.225/

# 下载文件
scp root@8.136.42.225:/www/wwwroot/8.136.42.225/remote_file.txt ./
```
