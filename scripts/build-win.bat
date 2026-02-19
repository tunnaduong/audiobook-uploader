@echo off
REM Build script for Windows executable
REM Usage: .\scripts\build-win.bat
REM Requirements: Node.js 18+, npm

echo.
echo 🔨 Building Audiobook Uploader for Windows...
echo.

echo Step 1: Checking prerequisites
echo ================================
node -v
npm -v
echo.

echo Step 2: Installing dependencies
echo ================================
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies
    exit /b 1
)
echo.

echo Step 3: Type checking
echo =====================
call npm run type-check
if %errorlevel% neq 0 (
    echo Type check failed
    exit /b 1
)
echo.

echo Step 4: Building Electron main process
echo ======================================
call npm run build:electron
if %errorlevel% neq 0 (
    echo Failed to build Electron
    exit /b 1
)
echo.

echo Step 5: Building React UI
echo ==========================
call npm run build:renderer
if %errorlevel% neq 0 (
    echo Failed to build renderer
    exit /b 1
)
echo.

echo Step 6: Building Windows executables with electron-builder
echo ===========================================================
call npm run build:win
if %errorlevel% neq 0 (
    echo Failed to build with electron-builder
    exit /b 1
)
echo.

if exist "dist\release" (
    echo ✅ Build completed successfully!
    echo.
    echo 📦 Output files:
    dir dist\release\*.exe
    echo.
    echo 📝 To verify the build:
    echo    - Run dist\release\Audiobook-Uploader-0.1.0-x64.exe
    echo    - Or install using the NSIS installer
) else (
    echo ⚠️  Build directory not found
    exit /b 1
)
