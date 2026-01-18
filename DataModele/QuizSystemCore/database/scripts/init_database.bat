@echo off
REM Скрипт инициализации базы данных PostgreSQL
echo ========================================
echo ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ
echo ========================================

REM Проверяем, установлен ли PostgreSQL
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo ОШИБКА: PostgreSQL не найден в PATH!
    echo Установите PostgreSQL: https://www.postgresql.org/download/
    pause
    exit /b 1
)

REM Параметры подключения
set PGHOST=localhost
set PGPORT=5432
set PGUSER=postgres
set PGPASSWORD=postgres
set PGDATABASE=quizsystem

echo Создание базы данных '%PGDATABASE%'...
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -c "CREATE DATABASE %PGDATABASE%;"

if %errorlevel% equ 0 (
    echo База данных успешно создана!
    
    REM Здесь можно добавить создание таблиц
    echo Создание таблиц...
    REM psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f create_tables.sql
    
    echo ========================================
    echo ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА УСПЕШНО!
    echo ========================================
) else (
    echo ========================================
    echo ОШИБКА ПРИ СОЗДАНИИ БАЗЫ ДАННЫХ!
    echo ========================================
)

pause