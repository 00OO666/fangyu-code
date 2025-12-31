@echo off
chcp 65001 >nul
echo ========================================
echo Fangyu-Code 新功能依赖安装脚本
echo ========================================
echo.

cd /d F:\Any-Code-Dev

echo [1/3] 安装必需依赖...
call npm install reactflow dagre uuid framer-motion anser @monaco-editor/react react-markdown react-syntax-highlighter

echo.
echo [2/3] 安装类型定义...
call npm install -D @types/dagre @types/uuid @types/react-syntax-highlighter

echo.
echo [3/3] 安装可选依赖 (PDF 和 OCR)...
call npm install pdf-parse tesseract.js

echo.
echo ========================================
echo ✅ 所有依赖安装完成！
echo ========================================
echo.
echo 接下来你可以：
echo 1. 查看 FEATURE_INTEGRATION_GUIDE.md 了解如何集成新功能
echo 2. 查看 QUICK_START_MULTI_AGENT.md 了解多代理系统
echo 3. 运行 npm run dev 启动开发服务器
echo.
pause
