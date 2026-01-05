---
inclusion: manual
---

# Security Scan - 安全扫描工具

> 从 Claude Code Skills 迁移

## 触发词
- "安全扫描"、"security scan"
- "漏洞检测"、"vulnerability scan"
- "SQL注入检测"、"SQL injection"
- "XSS检测"、"XSS scan"
- "安全审计"、"security audit"
- "OWASP"

## 核心能力
- **全面扫描** - 8大类安全检查 (SQL注入/XSS/危险函数/文件上传/反序列化/权限/敏感文件)
- **一键执行** - SSH 远程扫描命令，自动生成报告
- **分类扫描** - 支持针对特定漏洞类型的快速扫描
- **修复指南** - 提供每种漏洞的修复代码示例
- **风险评级** - CRITICAL/WARN/OK 三级风险分类

## 扫描类型

### 1. SQL 注入风险
```bash
grep -rn '\$_\(GET\|POST\|REQUEST\)' --include='*.php' . | grep -i 'query\|select' | grep -v prepare
```

### 2. XSS 风险
```bash
grep -rn 'echo.*\$_' --include='*.php' . | grep -v htmlspecialchars
```

### 3. 硬编码密码
```bash
grep -rn 'password\s*=' --include='*.php' . | grep -v 'empty\|null'
```

### 4. 危险函数
```bash
grep -rn 'eval(\|exec(\|system(' --include='*.php' .
```

### 5. 不安全的反序列化
```bash
grep -rn 'unserialize.*\$_' --include='*.php' .
```

## 安全修复指南

### SQL 注入修复
```php
// ❌ 错误示例
$id = $_GET['id'];
$sql = "SELECT * FROM users WHERE id = $id";

// ✅ 正确修复
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$_GET['id']]);
```

### XSS 修复
```php
// ❌ 错误示例
echo $_GET['name'];

// ✅ 正确修复
echo htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8');
```

### 文件上传安全
```php
// 添加类型验证
$allowed = ['jpg', 'jpeg', 'png', 'gif'];
$ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowed)) {
    die('不允许的文件类型');
}
```

## 风险等级说明

| 等级 | 说明 | 处理优先级 |
|------|------|-----------|
| CRITICAL | 危险函数、不安全反序列化、敏感文件暴露 | 立即修复 |
| WARN | SQL注入、XSS、硬编码密码 | 尽快修复 |
| OK | 无明显问题 | 定期复查 |
