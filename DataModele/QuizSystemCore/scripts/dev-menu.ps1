# Упрощенное меню разработчика
Clear-Host
Write-Host ""
Write-Host "=== QUIZ SYSTEM CORE - DEV MENU ===" -ForegroundColor Cyan
Write-Host ""

function Show-Menu {
    Write-Host "1. Build Project"
    Write-Host "2. Configure CMake"
    Write-Host "3. Clean Build"
    Write-Host "4. Initialize Database"
    Write-Host "5. Run Server"
    Write-Host "6. Run Tests"
    Write-Host "7. Check Dependencies"
    Write-Host "8. Open in VS Code"
    Write-Host "0. Exit"
    Write-Host ""
}

function Invoke-Build {
    Write-Host "Building project..." -ForegroundColor Yellow
    if (Test-Path "build") {
        cmake --build build --config Release
    } else {
        Write-Host "Build folder not found. Run Configure CMake first." -ForegroundColor Red
    }
    Read-Host "Press Enter to continue"
}

function Invoke-Configure {
    Write-Host "Configuring CMake..." -ForegroundColor Yellow
    cmake -B build -G "Visual Studio 17 2022" -A x64
    Read-Host "Press Enter to continue"
}

function Invoke-Clean {
    Write-Host "Cleaning build..." -ForegroundColor Yellow
    if (Test-Path "build") {
        Remove-Item -Path "build" -Recurse -Force
        Write-Host "Build folder removed" -ForegroundColor Green
    }
    Read-Host "Press Enter to continue"
}

function Invoke-InitDB {
    Write-Host "Initializing database..." -ForegroundColor Yellow
    if (Test-Path "database\scripts\init_database.bat") {
        & "database\scripts\init_database.bat"
    } else {
        Write-Host "Database script not found" -ForegroundColor Red
    }
}

function Invoke-RunServer {
    Write-Host "Running server..." -ForegroundColor Yellow
    if (Test-Path "bin\quiz_system_core.exe") {
        & "bin\quiz_system_core.exe"
    } else {
        Write-Host "Executable not found. Build project first." -ForegroundColor Red
        Read-Host "Press Enter to continue"
    }
}

function Invoke-CheckDeps {
    Write-Host "Checking dependencies..." -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "CMake:" -NoNewline
    if (Get-Command cmake -ErrorAction SilentlyContinue) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " NOT FOUND" -ForegroundColor Red
    }
    
    Write-Host "MSVC Compiler:" -NoNewline
    if (Get-Command cl -ErrorAction SilentlyContinue) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " NOT FOUND" -ForegroundColor Red
    }
    
    Write-Host "PostgreSQL:" -NoNewline
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " NOT FOUND" -ForegroundColor Red
    }
    
    Read-Host "Press Enter to continue"
}

# Главное меню
do {
    Clear-Host
    Write-Host ""
    Write-Host "=== QUIZ SYSTEM CORE - DEV MENU ===" -ForegroundColor Cyan
    Write-Host "Path: $(Get-Location)"
    Write-Host ""
    
    Show-Menu
    
    $choice = Read-Host "Enter choice"
    
    switch ($choice) {
        "1" { Invoke-Build }
        "2" { Invoke-Configure }
        "3" { Invoke-Clean }
        "4" { Invoke-InitDB }
        "5" { Invoke-RunServer }
        "6" { Write-Host "Tests not implemented yet" -ForegroundColor Yellow; Read-Host "Press Enter" }
        "7" { Invoke-CheckDeps }
        "8" { 
            if (Get-Command code -ErrorAction SilentlyContinue) {
                code .
            } else {
                Write-Host "VS Code not found in PATH" -ForegroundColor Red
                Read-Host "Press Enter"
            }
        }
        "0" { Write-Host "Exiting..."; break }
        default { Write-Host "Invalid choice" -ForegroundColor Red; Start-Sleep -Seconds 1 }
    }
} while ($choice -ne "0")