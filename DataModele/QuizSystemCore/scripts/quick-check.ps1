# Скрипт быстрой проверки проекта
Write-Host "=== БЫСТРАЯ ПРОВЕРКА ===" -ForegroundColor Cyan
Write-Host ""

# 1. Проверяем структуру папок
Write-Host "📁 Проверка структуры папок..." -ForegroundColor Yellow
$requiredFolders = @("src", "include", "build", "bin", "database\scripts", ".vscode")
$missingFolders = @()

foreach ($folder in $requiredFolders) {
    if (Test-Path $folder) {
        Write-Host "  ✅ $folder" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $folder" -ForegroundColor Red
        $missingFolders += $folder
    }
}

# 2. Проверяем основные файлы
Write-Host ""
Write-Host "📄 Проверка основных файлов..." -ForegroundColor Yellow
$requiredFiles = @("CMakeLists.txt", "README.md", ".gitignore", "database\scripts\init_database.bat")
$missingFiles = @()

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

# 3. Проверяем файлы VS Code
Write-Host ""
Write-Host "⚙️  Проверка настроек VS Code..." -ForegroundColor Yellow
$vscodeFiles = @(".vscode\settings.json", ".vscode\tasks.json", ".vscode\launch.json")
$missingVSCodeFiles = @()

foreach ($file in $vscodeFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file" -ForegroundColor Red
        $missingVSCodeFiles += $file
    }
}

# 4. Проверяем зависимости
Write-Host ""
Write-Host "🔧 Проверка зависимостей..." -ForegroundColor Yellow

$deps = @(
    @{Name = "CMake"; Command = "cmake --version"},
    @{Name = "MSVC Compiler"; Command = "cl"},
    @{Name = "PostgreSQL"; Command = "psql --version"},
    @{Name = "Git"; Command = "git --version"}
)

foreach ($dep in $deps) {
    Write-Host "  $($dep.Name)..." -NoNewline -ForegroundColor Gray
    try {
        $output = Invoke-Expression $dep.Command 2>$null
        if ($LASTEXITCODE -eq 0 -or $output) {
            Write-Host " ✅" -ForegroundColor Green
        } else {
            Write-Host " ❌" -ForegroundColor Red
        }
    } catch {
        Write-Host " ❌" -ForegroundColor Red
    }
}

# Вывод итогов
Write-Host ""
Write-Host "=== ИТОГИ  ===" -ForegroundColor Cyan

$totalMissing = $missingFolders.Count + $missingFiles.Count + $missingVSCodeFiles.Count

if ($totalMissing -eq 0) {
    Write-Host "Все проверки пройдены успешно!" -ForegroundColor Green
    Write-Host "Проект готов к работе!" -ForegroundColor Green
}
else {
    Write-Host "Обнаружены проблемы:" -ForegroundColor Yellow
    
    if ($missingFolders.Count -gt 0) {
        Write-Host "Отсутствующие папки:" -ForegroundColor Red
        foreach ($folder in $missingFolders) {
            Write-Host " - $folder" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Read-Host "Нажмите Enter для продолжения..."
