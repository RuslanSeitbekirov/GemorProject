Write-Host "=== ТЕСТИРОВАНИЕ СЕРВЕРА QUIZ SYSTEM ===" -ForegroundColor Cyan
Write-Host ""

# Проверяем, запущен ли сервер
Write-Host "🔍 Проверяю сервер на localhost:8080..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 2 -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Сервер работает!" -ForegroundColor Green
        Write-Host "📊 Ответ сервера:" -ForegroundColor Yellow
        
        # Парсим JSON ответ
        $json = $response.Content | ConvertFrom-Json
        $json | Format-List
        
        Write-Host ""
        Write-Host "🎉 Поздравляю! Проект успешно работает!" -ForegroundColor Green
        
    } else {
        Write-Host "⚠️  Сервер ответил с кодом: $($response.StatusCode)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Сервер не отвечает или не запущен" -ForegroundColor Red
    Write-Host ""
    Write-Host "🚀 Для запуска сервера:" -ForegroundColor Yellow
    Write-Host "1. Откройте новое окно PowerShell" -ForegroundColor White
    Write-Host "2. Выполните:" -ForegroundColor White
    Write-Host "   cd C:\pp\GemorProject\DataModele\QuizSystemCore\bin\release" -ForegroundColor White
    Write-Host "   .\quiz_system_core.exe" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Затем запустите этот тест снова" -ForegroundColor White
}

Write-Host ""
Write-Host "=== КОМАНДЫ ДЛЯ ТЕСТИРОВАНИЯ ===" -ForegroundColor Cyan
Write-Host "🌐 Основной endpoint: http://localhost:8080" -ForegroundColor White
Write-Host "📡 Тест через PowerShell:" -ForegroundColor White
Write-Host "   Invoke-WebRequest -Uri 'http://localhost:8080' | Select-Object -ExpandProperty Content" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 Для остановки сервера нажмите Ctrl+C в окне с сервером" -ForegroundColor Yellow

Pause