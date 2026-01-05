---
inclusion: manual
---

# PbootCMS Quick - 快速命令集

> 从 Claude Code Skills 迁移

## 触发词
- "完整部署"、"deploy full"
- "快速重启"、"quick restart"
- "查看日志"、"view logs"
- "检查状态"、"check status"
- "清除缓存"、"clear cache"
- "PbootCMS部署"

## 快速命令列表

### 1️⃣ 完整部署流程 (deploy-full)
清缓存 → 修复权限 → 重启服务 → 验证状态

```powershell
ssh root@8.136.42.225 "
echo '🚀 PbootCMS 完整部署流程'

# 步骤 1: 清除缓存
rm -rf /www/wwwroot/8.136.42.225/runtime/cache/* 2>/dev/null
rm -rf /www/wwwroot/8.136.42.225/runtime/compile/* 2>/dev/null
echo '✅ 缓存已清除'

# 步骤 2: 修复权限
chown -R www:www /www/wwwroot/8.136.42.225
chmod -R 755 /www/wwwroot/8.136.42.225
echo '✅ 权限已修复'

# 步骤 3: 重启服务
systemctl reload php-fpm-81
systemctl reload nginx
echo '✅ 服务已重启'

# 步骤 4: 验证状态
curl -s -o /dev/null -w 'HTTP: %{http_code}\n' http://localhost/
"
```

### 2️⃣ 快速查看日志 (logs)

```powershell
ssh root@8.136.42.225 "
echo '🔴 最近 20 条错误日志:'
tail -20 /www/wwwlogs/8.136.42.225-error.log | grep -v '^\$'

echo '🟢 最近 10 条访问日志:'
tail -10 /www/wwwlogs/8.136.42.225-access.log | awk '{print \$1, \$7, \$9}'
"
```

### 3️⃣ 服务器状态概览 (status)

```powershell
ssh root@8.136.42.225 "
echo '🔧 服务状态:'
for svc in nginx php-fpm-81 mysql; do
    systemctl is-active \$svc && echo \"✅ \$svc\" || echo \"❌ \$svc\"
done

echo '💾 磁盘空间:'
df -h /

echo '🧠 内存使用:'
free -h | grep Mem

echo '🌐 HTTP 状态:'
curl -s -o /dev/null -w 'HTTP: %{http_code}\n' http://localhost/
"
```

### 4️⃣ 一键重启所有服务 (restart-all)

```powershell
ssh root@8.136.42.225 "systemctl restart nginx php-fpm-81 mysql && echo '✅ 所有服务已重启'"
```

### 5️⃣ 紧急修复 (emergency-fix)
修复权限 → 清缓存 → 重启服务 → 验证

```powershell
ssh root@8.136.42.225 "
chown -R www:www /www/wwwroot/8.136.42.225
rm -rf /www/wwwroot/8.136.42.225/runtime/*
mkdir -p /www/wwwroot/8.136.42.225/runtime/{cache,compile}
chown -R www:www /www/wwwroot/8.136.42.225/runtime
systemctl restart nginx php-fpm-81
curl -s -o /dev/null -w 'HTTP: %{http_code}\n' http://localhost/
"
```

### 6️⃣ 只清除缓存 (clear-cache)

```powershell
ssh root@8.136.42.225 "
rm -rf /www/wwwroot/8.136.42.225/runtime/cache/* 2>/dev/null
rm -rf /www/wwwroot/8.136.42.225/runtime/compile/* 2>/dev/null
systemctl reload php-fpm-81
echo '✅ 缓存已清除'
"
```

### 7️⃣ 磁盘空间检查 (disk-check)

```powershell
ssh root@8.136.42.225 "
echo '📊 总体磁盘使用:'
df -h /

echo '📂 网站目录占用 (前 10 大):'
du -sh /www/wwwroot/8.136.42.225/* 2>/dev/null | sort -hr | head -10

echo '🗂️ 日志文件大小:'
ls -lh /www/wwwlogs/*.log 2>/dev/null
"
```

## 注意事项
1. 所有命令都在服务器 `root@8.136.42.225` 执行
2. `restart-all` 会导致短暂服务中断（约 2-3 秒）
3. `emergency-fix` 会清除所有缓存
4. 日志文件路径基于标准 BT 面板配置
