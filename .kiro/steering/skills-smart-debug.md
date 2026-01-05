---
inclusion: manual
---

# Smart Debug - 智能调试工具

> 从 Claude Code Skills 迁移

## 触发词
- "调试"、"debug"
- "诊断"、"diagnose"
- "网站打不开"、"site down"
- "502错误"、"502 error"
- "性能问题"、"performance issue"
- "找不到原因"

## 核心能力
- **全面诊断** - 7大类检查 (HTTP响应/服务状态/资源使用/错误日志/最近修改/缓存/权限)
- **关联分析** - 自动关联多个信息源，识别问题根源
- **智能建议** - 根据诊断结果提供针对性修复方案

## 工作流程

### 阶段1: 信息收集
1. HTTP 响应检查 (状态码/响应大小)
2. 服务状态检查 (nginx/php-fpm/mysql)
3. 资源使用情况 (内存/磁盘/CPU)
4. 错误日志收集
5. 最近修改记录
6. 缓存状态检查
7. 权限检查

### 阶段2: 关联分析
1. 关联错误日志和服务状态
2. 关联资源使用和性能问题
3. 关联最近修改和新出现的错误
4. 识别问题根本原因

### 阶段3: 修复方案
1. 设计修复方案
2. 评估修复风险
3. 提供具体修复命令

## 一键智能诊断 (PbootCMS)

```powershell
ssh root@8.136.42.225 "
echo '========================================'
echo '     PbootCMS 智能诊断报告              '
echo '========================================'

# 1. HTTP 健康检查
echo '[1/7] HTTP 响应检查'
HTTP_CODE=`curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://localhost/`
echo \"  状态码: \$HTTP_CODE\"

# 2. 服务状态
echo '[2/7] 服务状态检查'
for svc in nginx php-fpm-81 mysqld; do
    systemctl is-active \$svc && echo \"  [OK] \$svc\" || echo \"  [FAIL] \$svc\"
done

# 3. 资源使用
echo '[3/7] 资源使用情况'
free -h | grep Mem
df -h /

# 4-7. 权限、缓存、最近修改、错误日志...
"
```

## 诊断结果解读

| 症状 | 可能原因 | 修复方案 |
|------|---------|---------|
| HTTP 502 + PHP-FPM停止 | PHP-FPM 崩溃 | `systemctl restart php-fpm-81` |
| HTTP 403 + 权限不是 www:www | 文件权限错误 | `chown -R www:www /www/wwwroot/8.136.42.225` |
| HTTP 200 + 响应<100字节 | 模板缓存问题 | `rm -rf /www/wwwroot/8.136.42.225/runtime/*` |
| 内存>85% | 内存不足 | 清理进程或重启服务 |
| 磁盘>90% | 磁盘空间不足 | 清理日志或备份文件 |

## 快速修复命令

```powershell
# 一键修复常见问题 (权限 + 缓存 + 重启)
ssh root@8.136.42.225 "chown -R www:www /www/wwwroot/8.136.42.225 && rm -rf /www/wwwroot/8.136.42.225/runtime/* && systemctl restart nginx php-fpm-81"
```
