# Скрипт запуска тестов
param(
    [string]$TestType = "all",  # all, unit, integration
    [string]$BuildType = "Release",
    [switch]$Clean,
    [switch]$Verbose,
    [switch]$Help
)

function Show-Help {
    Write-Host "=== ЗАПУСК ТЕСТОВ QUIZ SYSTEM CORE ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Использование: .\scripts\run-tests.ps1 [параметры]"
    Write-Host ""
    Write-Host "Параметры:"
    Write-Host "  -TestType <тип>     : Тип тестов (all, unit, integration) [по умолчанию: all]"
    Write-Host "  -BuildType <тип>    : Тип сборки (Debug, Release) [по умолчанию: Release]"
    Write-Host "  -Clean              : Очистить перед сборкой"
    Write-Host "  -Verbose            : Подробный вывод"
    Write-Host "  -Help               : Показать эту справку"
    Write-Host ""
    Write-Host "Примеры:"
    Write-Host "  .\scripts\run-tests.ps1                          # Запустить все тесты"
    Write-Host "  .\scripts\run-tests.ps1 -TestType unit          # Только модульные тесты"
    Write-Host "  .\scripts\run-tests.ps1 -BuildType Debug -Verbose # Отладочная сборка с подробным выводом"
    Write-Host ""
}

if ($Help) {
    Show-Help
    exit 0
}

Write-Host "=== ЗАПУСК ТЕСТОВ QUIZ SYSTEM CORE ===" -ForegroundColor Cyan
Write-Host "Тип тестов: $TestType" -ForegroundColor Yellow
Write-Host "Тип сборки: $BuildType" -ForegroundColor Yellow
Write-Host ""

# Проверяем, что мы в корне проекта
if (-not (Test-Path "CMakeLists.txt")) {
    Write-Host "❌ Ошибка: скрипт должен запускаться из корня проекта!" -ForegroundColor Red
    exit 1
}

# Очищаем если нужно
if ($Clean) {
    Write-Host "🧹 Очистка предыдущей сборки..." -ForegroundColor Yellow
    if (Test-Path "build") {
        Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Папка build удалена" -ForegroundColor Green
    }
}

# Создаем папку build если не существует
if (-not (Test-Path "build")) {
    Write-Host "📁 Создание папки сборки..." -ForegroundColor Yellow
    New-Item -Path "build" -ItemType Directory -Force | Out-Null
}

# Конфигурируем CMake
Write-Host "⚙️  Конфигурация CMake..." -ForegroundColor Yellow
$cmakeArgs = @(
    "-S", ".",
    "-B", "build",
    "-G", "Visual Studio 17 2022",
    "-A", "x64",
    "-DCMAKE_TOOLCHAIN_FILE=C:/vcpkg/scripts/buildsystems/vcpkg.cmake",
    "-DBUILD_TESTS=ON",
    "-DCMAKE_BUILD_TYPE=$BuildType"
)

if ($Verbose) {
    Write-Host "CMake аргументы: $($cmakeArgs -join ' ')" -ForegroundColor Gray
}

& cmake $cmakeArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка конфигурации CMake!" -ForegroundColor Red
    exit 1
}

# Собираем проект
Write-Host "🔨 Сборка проекта..." -ForegroundColor Yellow
$buildArgs = @(
    "--build", "build",
    "--config", $BuildType,
    "--parallel", "8"
)

if ($Verbose) {
    $buildArgs += "--verbose"
    Write-Host "Сборка аргументы: $($buildArgs -join ' ')" -ForegroundColor Gray
}

& cmake $buildArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка сборки!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Сборка завершена успешно!" -ForegroundColor Green
Write-Host ""

# Запускаем тесты
Write-Host "🧪 ЗАПУСК ТЕСТОВ..." -ForegroundColor Cyan

$testArgs = @(
    "--test-dir", "build",
    "--build-config", $BuildType,
    "--output-on-failure"
)

if ($Verbose) {
    $testArgs += "-V"
}

if ($TestType -eq "unit") {
    $testArgs += "--tests-regex", ".*UnitTest.*"
} elseif ($TestType -eq "integration") {
    $testArgs += "--tests-regex", ".*IntegrationTest.*"
}

Write-Host "CTest аргументы: $($testArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

Push-Location "build"
try {
    & ctest $testArgs
    $testExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

Write-Host ""
if ($testExitCode -eq 0) {
    Write-Host "🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!" -ForegroundColor Green
} else {
    Write-Host "❌ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛИЛИСЬ" -ForegroundColor Red
}

exit $testExitCode