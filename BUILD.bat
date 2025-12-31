@echo off
chcp 65001 >nul
cd /d F:\Any-Code-Dev

echo ================================================
echo    Fangyu Code Build Script
echo ================================================
echo.

set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo [1/3] Checking environment...
rustc --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Rust not found. Please restart your computer.
    pause
    exit /b 1
)
echo [OK] Rust installed
echo.

echo [2/3] Building frontend...
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed
    pause
    exit /b 1
)
echo [OK] Frontend built
echo.

echo [3/3] Building Tauri app (10-20 min for first time)...
echo Please wait, you will see compilation progress below...
echo.

call npx tauri build

if errorlevel 1 (
    echo.
    echo ================================================
    echo    BUILD FAILED
    echo ================================================
    pause
    exit /b 1
)

echo.
echo ================================================
echo    BUILD SUCCESS!
echo ================================================
echo.
echo Installer location:
dir /b F:\Any-Code-Dev\src-tauri\target\release\bundle\nsis\*.exe 2>nul
echo.
echo Opening folder...
timeout /t 2 >nul
explorer F:\Any-Code-Dev\src-tauri\target\release\bundle\nsis
