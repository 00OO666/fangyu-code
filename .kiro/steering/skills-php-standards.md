---
inclusion: manual
---

# PHP Coding Standards - PHP 编码规范

> 从 Claude Code Skills 迁移

## 触发词
- "写PHP代码"、"write PHP code"
- "PHP规范"、"PHP standards"
- "编码标准"、"coding standards"
- "代码安全"、"code security"
- "SQL注入"、"SQL injection"
- "XSS防护"、"XSS protection"

## 核心原则

### 安全第一
- **预处理语句** - 所有数据库查询使用 PDO prepared statements
- **输出转义** - 用户输出使用 `htmlspecialchars()` 防止 XSS
- **输入验证** - 所有用户输入都需要白名单验证
- **CSRF 防护** - 表单需要 CSRF Token 验证

### 代码质量
- **PSR-12 规范** - 遵循 PHP Framework Interop Group 标准
- **错误处理** - 使用 try-catch 和日志记录
- **代码复用** - 避免重复代码，提取通用函数
- **注释清晰** - 中文注释说明逻辑

## 常见错误与修正

### ❌ 危险的 SQL 注入
```php
// 错误 - 直接拼接 SQL
$sql = "SELECT * FROM users WHERE id = " . $_GET['id'];
$result = $pdo->query($sql);
```

### ✅ 正确的预处理
```php
// 正确 - 使用预处理语句
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$_GET['id']]);
$result = $stmt->fetchAll();
```

### ❌ XSS 漏洞
```php
// 错误 - 直接输出用户数据
echo "欢迎 " . $_GET['name'];
```

### ✅ 安全的输出
```php
// 正确 - 转义输出
echo "欢迎 " . htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8');
```

### ❌ 不安全的文件上传
```php
// 错误 - 没有类型验证
move_uploaded_file($_FILES['file']['tmp_name'], $target);
```

### ✅ 安全的文件上传
```php
// 正确 - 白名单验证
$allowed = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
$ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowed)) {
    die('不允许的文件类型');
}
move_uploaded_file($_FILES['file']['tmp_name'], $target);
```

## PbootCMS 特定规范

### 文件操作
- ✅ 上传白名单：`.jpg`, `.png`, `.gif`, `.pdf`
- ❌ 禁止上传：`.php`, `.phtml`, `.exe`

### 权限处理
- 文件权限：`644`
- 目录权限：`755`
- 所有者：`www:www`

## 必备检查清单

修改 PHP 代码后，检查：
- [ ] 使用了 PDO 预处理语句
- [ ] 输出已转义 `htmlspecialchars()`
- [ ] 文件上传有白名单
- [ ] 表单有 CSRF Token 验证
- [ ] 错误日志无异常
- [ ] 代码通过 `php -l` 语法检查

## 数据库操作模板

### 查询单条记录
```php
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$id]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
```

### 查询多条记录
```php
$stmt = $pdo->prepare("SELECT * FROM products WHERE category = ? ORDER BY id DESC LIMIT ?");
$stmt->execute([$category, $limit]);
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 插入数据
```php
$stmt = $pdo->prepare("INSERT INTO users (name, email) VALUES (?, ?)");
$stmt->execute([$name, $email]);
$lastId = $pdo->lastInsertId();
```

### 更新数据
```php
$stmt = $pdo->prepare("UPDATE users SET name = ?, email = ? WHERE id = ?");
$stmt->execute([$name, $email, $id]);
$affected = $stmt->rowCount();
```
