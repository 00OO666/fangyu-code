@echo off
echo ========================================
echo 清理 Fangyu Code 数据库
echo ========================================
echo.
echo 正在删除数据库文件...
del "C:\Users\666\AppData\Roaming\com.fangyu.code\agents.db" 2>nul
if %errorlevel% equ 0 (
    echo ✅ 数据库已成功删除
    echo.
    echo 下次启动 Fangyu Code 时，应用会自动创建新的数据库
    echo 会话存储路径将恢复为默认值
) else (
    echo ❌ 删除失败
    echo.
    echo 可能原因：
    echo 1. Fangyu Code 应用仍在运行（请完全关闭应用）
    echo 2. 文件不存在（已经被删除）
    echo 3. 权限不足（请以管理员身份运行）
)
echo.
pause
