Write-Host "=== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ QUIZ SYSTEM ===" -ForegroundColor Cyan
Write-Host ""

# 1. ПРОВЕРЯЕМ POSTGRESQL
Write-Host "[1/6] Проверяем PostgreSQL..." -ForegroundColor Yellow

$postgresService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue

if (-not $postgresService) {
    Write-Host "❌ Служба PostgreSQL не найдена!" -ForegroundColor Red
    Write-Host "   Проверьте установку PostgreSQL 18" -ForegroundColor Yellow
    exit 1
}

if ($postgresService.Status -ne "Running") {
    Write-Host "⚠️  PostgreSQL не запущен, пробую запустить..." -ForegroundColor Yellow
    try {
        Start-Service -Name $postgresService.Name
        Start-Sleep -Seconds 3
        Write-Host "✅ PostgreSQL запущен" -ForegroundColor Green
    } catch {
        Write-Host "❌ Не удалось запустить PostgreSQL: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ PostgreSQL уже запущен" -ForegroundColor Green
}

# 2. СОЗДАЕМ БАЗУ ДАННЫХ
Write-Host ""
Write-Host "[2/6] Создаем базу данных quiz_system..." -ForegroundColor Yellow

$dbExists = psql -U postgres -lqt | cut -d \| -f 1 | grep -qw quiz_system

if ($LASTEXITCODE -eq 0) {
    Write-Host "⚠️  База данных quiz_system уже существует" -ForegroundColor Yellow
} else {
    try {
        psql -U postgres -c "CREATE DATABASE quiz_system;"
        Write-Host "✅ База данных создана" -ForegroundColor Green
    } catch {
        Write-Host "❌ Ошибка создания БД: $_" -ForegroundColor Red
        exit 1
    }
}

# 3. СОЗДАЕМ ПОЛЬЗОВАТЕЛЯ
Write-Host ""
Write-Host "[3/6] Создаем пользователя quiz_app..." -ForegroundColor Yellow

$userExists = psql -U postgres -d quiz_system -c "\du" | Select-String "quiz_app"

if ($userExists) {
    Write-Host "⚠️  Пользователь quiz_app уже существует" -ForegroundColor Yellow
} else {
    try {
        psql -U postgres -c "CREATE USER quiz_app WITH PASSWORD 'QuizAppPassword123!';"
        Write-Host "✅ Пользователь создан" -ForegroundColor Green
    } catch {
        Write-Host "❌ Ошибка создания пользователя: $_" -ForegroundColor Red
        exit 1
    }
}

# 4. ДАЕМ ПРАВА
Write-Host ""
Write-Host "[4/6] Настраиваем права доступа..." -ForegroundColor Yellow

try {
    # Даем права на базу данных
    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE quiz_system TO quiz_app;"
    
    # Даем права на схему
    psql -U postgres -d quiz_system -c "
        GRANT ALL ON SCHEMA public TO quiz_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO quiz_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO quiz_app;
    "
    
    Write-Host "✅ Права доступа настроены" -ForegroundColor Green
} catch {
    Write-Host "❌ Ошибка настройки прав: $_" -ForegroundColor Red
    exit 1
}

# 5. СОЗДАЕМ ТАБЛИЦЫ
Write-Host ""
Write-Host "[5/6] Создаем таблицы..." -ForegroundColor Yellow

$tablesSQL = @"
-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Таблица тестов
CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT false
);

-- Таблица вопросов
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    points INTEGER DEFAULT 1
);

-- Таблица ответов
CREATE TABLE IF NOT EXISTS answer_options (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false
);
"@

try {
    # Сохраняем SQL во временный файл
    $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $tablesSQL | Out-File -FilePath $tempFile -Encoding UTF8
    
    # Выполняем SQL
    psql -U quiz_app -d quiz_system -f $tempFile
    
    # Удаляем временный файл
    Remove-Item $tempFile -Force
    
    Write-Host "✅ Таблицы созданы" -ForegroundColor Green
} catch {
    Write-Host "❌ Ошибка создания таблиц: $_" -ForegroundColor Red
    exit 1
}

# 6. ДОБАВЛЯЕМ ТЕСТОВЫЕ ДАННЫЕ
Write-Host ""
Write-Host "[6/6] Добавляем тестовые данные..." -ForegroundColor Yellow

$testDataSQL = @"
-- Тестовый администратор (пароль: admin123)
INSERT INTO users (email, full_name, password_hash) VALUES
('admin@quizsystem.com', 'Администратор Системы', '\$2a\$12\$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa')
ON CONFLICT (email) DO NOTHING;

-- Тестовый преподаватель (пароль: teacher123)
INSERT INTO users (email, full_name, password_hash) VALUES
('teacher@quizsystem.com', 'Тестовый Преподаватель', '\$2a\$12\$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa')
ON CONFLICT (email) DO NOTHING;

-- Тестовый студент (пароль: student123)
INSERT INTO users (email, full_name, password_hash) VALUES
('student@quizsystem.com', 'Тестовый Студент', '\$2a\$12\$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa')
ON CONFLICT (email) DO NOTHING;
"@

try {
    # Сохраняем SQL во временный файл
    $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $testDataSQL | Out-File -FilePath $tempFile -Encoding UTF8
    
    # Выполняем SQL
    psql -U quiz_app -d quiz_system -f $tempFile
    
    # Удаляем временный файл
    Remove-Item $tempFile -Force
    
    Write-Host "✅ Тестовые данные добавлены" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ошибка добавления тестовых данных: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ЗАВЕРШЕНА!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 ПАРАМЕТРЫ ПОДКЛЮЧЕНИЯ:" -ForegroundColor Yellow
Write-Host "   Хост: localhost:5432" -ForegroundColor White
Write-Host "   База данных: quiz_system" -ForegroundColor White
Write-Host "   Пользователь: quiz_app" -ForegroundColor White
Write-Host "   Пароль: QuizAppPassword123!" -ForegroundColor White
Write-Host ""
Write-Host "👥 ТЕСТОВЫЕ ПОЛЬЗОВАТЕЛИ:" -ForegroundColor Yellow
Write-Host "   admin@quizsystem.com / admin123" -ForegroundColor White
Write-Host "   teacher@quizsystem.com / teacher123" -ForegroundColor White
Write-Host "   student@quizsystem.com / student123" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Для подключения к БД выполните:" -ForegroundColor Cyan
Write-Host "   psql -U quiz_app -d quiz_system" -ForegroundColor White
Write-Host ""

Pause