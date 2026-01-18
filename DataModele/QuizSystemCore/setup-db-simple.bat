@echo off 
 
echo ======================================== 
echo НАСТРОЙКА БАЗЫ ДАННЫХ QUIZ SYSTEM 
echo ======================================== 
echo. 
 
echo [1/4] Проверяю PostgreSQL... 
where psql >nul 2>nul 
if errorlevel 1 ( 
  echo ? PostgreSQL не найден в PATH 
  echo    Установите PostgreSQL 18 
  pause 
  exit /b 1 
) 
 
echo ? PostgreSQL найден 
echo. 
 
echo [2/4] Пробую подключиться к PostgreSQL... 
echo Введите пароль пользователя postgres: 
set /p pg_password=Пароль: 
 
set PGPASSWORD=%pg_password% 
psql -U postgres -c "SELECT version();" >nul 2>nul 
if errorlevel 1 ( 
  echo ? Не могу подключиться к PostgreSQL 
  echo    Проверьте пароль и что служба запущена 
  pause 
  exit /b 1 
) 
 
echo ? Подключение успешно 
echo. 
 
echo [3/4] Создаю базу данных quiz_system... 
psql -U postgres -c "CREATE DATABASE quiz_system;" 2>nul 
if errorlevel 0 ( 
  echo ? База данных создана 
) else ( 
  echo ??  База данных уже существует 
) 
echo. 
 
echo [4/4] Создаю пользователя quiz_app... 
psql -U postgres -c "CREATE USER quiz_app WITH PASSWORD 'QuizAppPassword123!';" 2>nul 
if errorlevel 0 ( 
  echo ? Пользователь создан 
) else ( 
  echo ??  Пользователь уже существует 
) 
 
echo ======================================== 
echo БАЗА ДАННЫХ ГОТОВА! 
echo ======================================== 
echo. 
echo ?? ДАННЫЕ ДЛЯ ПОДКЛЮЧЕНИЯ: 
echo. 
echo    Сервер:    localhost:5432 
echo    База:      quiz_system 
echo    Пользователь: quiz_app 
echo    Пароль:    QuizAppPassword123! 
echo. 
pause 
