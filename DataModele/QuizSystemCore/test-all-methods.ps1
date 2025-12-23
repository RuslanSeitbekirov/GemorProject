# C:\pp\GemorProject\DataModele\QuizSystemCore\test-all-methods.ps1

Write-Host "=== ТЕСТИРОВАНИЕ ВСЕХ HTTP МЕТОДОВ ===" -ForegroundColor Cyan

$baseUrl = "http://localhost:8080"

# 1. GET запрос
Write-Host "1. 📨 Тестирую GET запрос..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $baseUrl -Method GET -TimeoutSec 3
    Write-Host "   ✅ GET: $($response.StatusCode) OK" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "   📄 Ответ: $($json.message)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ GET не работает: $_" -ForegroundColor Red
}

# 2. POST запрос
Write-Host "2. 📨 Тестирую POST запрос..." -ForegroundColor Yellow
try {
    $body = @{
        test = "данные"
        value = 123
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri $baseUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 3
    Write-Host "   ✅ POST: $($response.StatusCode) OK" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  POST: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== СВОДКА ===" -ForegroundColor Cyan
Write-Host "📍 Адрес сервера: $baseUrl" -ForegroundColor White
Write-Host "📁 Исполняемый файл: C:\pp\GemorProject\DataModele\QuizSystemCore\bin\release\quiz_system_core.exe" -ForegroundColor White
Write-Host "📦 Размер файла: $([math]::Round((Get-Item 'C:\pp\GemorProject\DataModele\QuizSystemCore\bin\release\quiz_system_core.exe').Length / 1KB, 2)) KB" -ForegroundColor White

Pause