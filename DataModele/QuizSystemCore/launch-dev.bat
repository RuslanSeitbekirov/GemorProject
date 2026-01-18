@echo off
echo ========================================
echo QUIZ SYSTEM CORE - LAUNCH DEVELOPMENT
echo ========================================
echo.

REM Проверяем, запущен ли PostgreSQL
echo Checking PostgreSQL...
netstat -an | find ":5432" > nul
if %errorlevel% equ 0 (
    echo PostgreSQL is running.
) else (
    echo PostgreSQL is not running!
    echo Starting PostgreSQL service...
    net start postgresql-x64-18 2>nul
    if %errorlevel% neq 0 (
        echo Failed to start PostgreSQL!
        echo Please start it manually from Services.
        pause
        exit /b 1
    )
    timeout /t 5 /nobreak > nul
)

REM Проверяем базу данных
echo Checking database quiz_system...
psql -U postgres -d quiz_system -c "SELECT 1" > nul 2>&1
if %errorlevel% equ 0 (
    echo Database quiz_system exists.
) else (
    echo Database quiz_system not found!
    echo Running database initialization...
    call database\scripts\init_database.bat
    if %errorlevel% neq 0 (
        echo Database initialization failed!
        pause
        exit /b 1
    )
)

REM Проверяем сборку
echo Checking project build...
if exist "build\CMakeCache.txt" (
    echo CMake cache found.
) else (
    echo Project not configured!
    echo Configuring CMake...
    cmake -B build -G "Visual Studio 17 2022" -A x64 -DCMAKE_TOOLCHAIN_FILE=C:/vcpkg/scripts/buildsystems/vcpkg.cmake
    if %errorlevel% neq 0 (
        echo CMake configuration failed!
        pause
        exit /b 1
    )
)

if exist "bin\quiz_system_core.exe" (
    echo Executable found.
) else (
    echo Executable not found!
    echo Building project...
    cmake --build build --config Release
    if %errorlevel% neq 0 (
        echo Build failed!
        pause
        exit /b 1
    )
)

REM Открываем VS Code с workspace
echo Opening VS Code...
start "" "quiz-system.code-workspace" 2>nul
if %errorlevel% neq 0 (
    start "" "C:\Program Files\Microsoft VS Code\Code.exe" "quiz-system.code-workspace" 2>nul
    if %errorlevel% neq 0 (
        echo VS Code not found. Please open it manually.
    )
)

echo.
echo ========================================
echo READY! Project opened in VS Code
echo ========================================
echo.
echo Next steps:
echo 1. Wait for VS Code to load
echo 2. Press F5 to debug
echo 3. Or Ctrl+Shift+B to build
echo.
pause