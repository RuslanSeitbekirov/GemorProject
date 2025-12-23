@echo off
echo ========================================
echo ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ QUIZ SYSTEM
echo ========================================
echo.

REM Проверяем PostgreSQL
echo [1/5] Проверка PostgreSQL...
sc query postgresql-x64-18 > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL не запущен!
    echo    Запускаю службу...
    net start postgresql-x64-18 > nul 2>&1
    timeout /t 3 /nobreak > nul
    echo ✅ PostgreSQL запущен
) else (
    echo ✅ PostgreSQL уже запущен
)

REM Простая проверка подключения
echo.
echo [2/5] Проверка подключения к PostgreSQL...
psql -U postgres -c "SELECT version();" > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Не удалось подключиться к PostgreSQL!
    echo    Проверьте:
    echo    1. Установлен ли PostgreSQL 18
    echo    2. Запущена ли служба postgresql-x64-18
    echo    3. Правильный ли пароль для пользователя postgres
    pause
    exit /b 1
)
echo ✅ Подключение к PostgreSQL успешно

REM Инструкции для пользователя
echo.
echo [3/5] Для создания базы данных выполните команды:
echo.
echo 1. Создайте базу данных:
echo    psql -U postgres -c "CREATE DATABASE quiz_system;"
echo.
echo 2. Создайте пользователя:
echo    psql -U postgres -c "CREATE USER quiz_app WITH PASSWORD 'QuizAppPassword123!';"
echo.
echo 3. Дайте права:
echo    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE quiz_system TO quiz_app;"
echo.
echo [4/5] Или используйте PowerShell скрипт:
echo    powershell -ExecutionPolicy Bypass -File "..\..\scripts\init-database.ps1"
echo.
echo [5/5] Для подключения к БД:
echo    psql -U quiz_app -d quiz_system
echo.
pause