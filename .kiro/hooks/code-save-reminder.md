---
name: code-save-reminder
version: 1.0.0
triggers:
  - type: file-saved
    pattern: "**/*.{ts,tsx,rs}"
agent:
  prompt: |
    用户刚保存了代码文件。如果是 Fangyu Code 项目的文件：
    1. 提醒用户修改后需要重新构建才能生效
    2. 不要自动执行构建命令
    3. 如果修改了版本相关文件，提醒检查三处版本号是否同步
---

# 代码保存提醒

当用户保存 TypeScript 或 Rust 文件时，提醒相关注意事项。
