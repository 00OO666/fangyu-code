# Kiro CLI 安装指南（Windows WSL）

## 步骤 1: 打开 WSL 终端

```powershell
# 在 PowerShell 中运行
wsl -d Ubuntu
```

## 步骤 2: 安装依赖

```bash
# 在 WSL 中运行
sudo apt-get update
sudo apt-get install -y unzip curl
```

## 步骤 3: 安装 Kiro CLI

```bash
# 在 WSL 中运行
curl -fsSL https://cli.kiro.dev/install | bash
```

## 步骤 4: 重新加载 shell

```bash
# 在 WSL 中运行
source ~/.bashrc
# 或者
exec bash
```

## 步骤 5: 登录 Kiro

```bash
# 在 WSL 中运行
kiro-cli login
```

这会打开浏览器让你登录（使用 GitHub/Google/AWS Builder ID）

## 步骤 6: 验证安装

```bash
# 在 WSL 中运行
kiro-cli --version
kiro-cli doctor
```

## 步骤 7: 测试对话

```bash
# 在 WSL 中运行
kiro-cli chat
```

---

## 常用命令

```bash
# 开始对话
kiro-cli chat

# 恢复之前的对话
kiro-cli chat --resume

# 指定模型
kiro-cli chat --model claude-opus-4.5

# 检查状态
kiro-cli doctor

# 查看帮助
kiro-cli --help
```

---

## 安装完成后

安装完成后，告诉我，我会继续帮你集成到 Fangyu Code 中。
