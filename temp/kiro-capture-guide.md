# Kiro API 抓包分析指南

## 准备工作

### 1. 下载 Fiddler Classic（免费）
https://www.telerik.com/download/fiddler

### 2. 配置 HTTPS 解密
1. 打开 Fiddler → Tools → Options → HTTPS
2. 勾选 "Capture HTTPS CONNECTs"
3. 勾选 "Decrypt HTTPS traffic"
4. 点击 "Actions" → "Trust Root Certificate"（安装证书）

### 3. 配置 Kiro 使用代理
Electron 应用需要设置环境变量才能走代理：

```powershell
# 方法 1：临时设置（推荐）
$env:HTTP_PROXY = 'http://127.0.0.1:8888'
$env:HTTPS_PROXY = 'http://127.0.0.1:8888'
$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'

# 启动 Kiro
& 'F:\软件\一级重要软件\Kiro\Kiro.exe'
```

```powershell
# 方法 2：修改 Kiro 快捷方式
# 目标改为：
"F:\软件\一级重要软件\Kiro\Kiro.exe" --proxy-server=http://127.0.0.1:8888 --ignore-certificate-errors
```

## 抓包步骤

### 1. 启动 Fiddler
确保左下角显示 "Capturing"

### 2. 设置过滤器（可选）
在右侧 Filters 标签：
- 勾选 "Use Filters"
- Hosts: "Show only the following Hosts"
- 输入: `*.amazonaws.com; *.kiro.dev`

### 3. 启动 Kiro（带代理）
```powershell
$env:HTTP_PROXY = 'http://127.0.0.1:8888'
$env:HTTPS_PROXY = 'http://127.0.0.1:8888'
$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'
& 'F:\软件\一级重要软件\Kiro\Kiro.exe'
```

### 4. 在 Kiro 中发送一条消息
随便问一个问题，触发 API 调用

### 5. 在 Fiddler 中查找请求
关注以下域名：
- `bedrock-runtime.*.amazonaws.com` - Bedrock API
- `*.kiro.dev` - Kiro 服务

### 6. 分析请求
点击请求 → Inspectors 标签：
- **Headers**: 查看 Authorization 头
- **Raw**: 查看完整请求
- **JSON**: 查看请求体

## 关键信息

### 需要捕获的内容
1. **Authorization 头** - 认证方式（Bearer Token? SigV4?）
2. **X-Amz-* 头** - AWS 签名信息
3. **请求 URL** - 实际调用的端点
4. **请求体** - API 格式

### 预期发现
- 如果是 SigV4 签名：会有 `Authorization: AWS4-HMAC-SHA256 ...`
- 如果是 Bearer Token：会有 `Authorization: Bearer ...`
- 如果是 API Key：会有 `x-api-key: ...`

## 导出抓包结果

1. 选中相关请求
2. File → Export Sessions → Selected Sessions
3. 保存为 .saz 文件（可以发给我分析）

或者直接复制 Raw 请求内容。
