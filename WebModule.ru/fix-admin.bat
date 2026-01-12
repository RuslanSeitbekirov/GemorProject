@echo off
echo 🔧 Исправление проблемы с администратором
echo.

echo 1. Останавливаем сервер...
taskkill /F /IM node.exe > nul 2>&1
echo.

echo 2. Проверяем Docker контейнер...
docker start TestDataBase > nul 2>&1
if errorlevel 1 (
    echo Создаю новый контейнер PostgreSQL...
    docker run --name TestDataBase -p 5438:5432 -e POSTGRES_PASSWORD=12345 -d postgres
    timeout /t 5 /nobreak > nul
)
echo.

echo 3. Создаем/проверяем администратора...
node create-admin.js
echo.

echo 4. Проверяем систему...
node check-system.js
echo.

echo 5. Запускаем сервер...
echo Сервер будет доступен по адресу: http://localhost:3000
echo.
start cmd /k "npm start"