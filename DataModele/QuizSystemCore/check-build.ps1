Write-Host "===  ? ? ===" -ForegroundColor Cyan
Write-Host "???: C:\pp\GemorProject\DataModele\QuizSystemCore" -ForegroundColor Yellow
Write-Host ""

# ???????? ??????? ???????? ??????
Write-Host "? ? ?..." -ForegroundColor Gray

$files = @(
    @{Name = "CMakeLists.txt"; Path = "CMakeLists.txt"},
    @{Name = "README.md"; Path = "README.md"},
    @{Name = ".gitignore"; Path = ".gitignore"},
    @{Name = "setup-db-simple.bat"; Path = "setup-db-simple.bat"},
    @{Name = "database/schema.sql"; Path = "database\schema.sql"}
)

foreach ($file in $files) {
    $fullPath = Join-Path "C:\pp\GemorProject\DataModele\QuizSystemCore" $file.Path
    if (Test-Path $fullPath) {
        Write-Host "  OK $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "  NO $($file.Name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "? VCPKG  ?..." -ForegroundColor Gray

# ???????? vcpkg
if (Test-Path "C:\vcpkg") {
    Write-Host "  OK vcpkg ?????????? ? C:\vcpkg" -ForegroundColor Green
    
    # ???????? ????????????? ??????????
    try {
        $vcpkgList = & "C:\vcpkg\vcpkg.exe" list
        if ($LASTEXITCODE -eq 0) {
            $libs = @("cpprestsdk", "openssl", "spdlog", "fmt", "nlohmann-json")
            foreach ($lib in $libs) {
                if ($vcpkgList -match $lib) {
                    Write-Host "  OK $lib" -ForegroundColor Green
                } else {
                    Write-Host "  NO $lib" -ForegroundColor Red
                }
            }
        }
    } catch {
        Write-Host "  ????? ???????? vcpkg" -ForegroundColor Red
    }
} else {
    Write-Host "  NO vcpkg ?? ?????? ? C:\vcpkg" -ForegroundColor Red
}

Write-Host ""
Write-Host "? POSTGRESQL..." -ForegroundColor Gray

# ???????? PostgreSQL
$postgresPath = "C:\Program Files\PostgreSQL\18"
if (Test-Path $postgresPath) {
    Write-Host "  OK PostgreSQL ??????????" -ForegroundColor Green
    
    # ???????? ??????
    $pgService = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
    if ($pgService) {
        if ($pgService.Status -eq 'Running') {
            Write-Host "  OK ?????? PostgreSQL ????????" -ForegroundColor Green
        } else {
            Write-Host "  WARN ?????? PostgreSQL ???????????" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  NO PostgreSQL ?? ??????" -ForegroundColor Red
}

Write-Host ""
Write-Host "? ??? ..." -ForegroundColor Gray

# ???????? ?????
$folders = @("src", "include", "bin", "build", "database", "logs")
foreach ($folder in $folders) {
    $fullPath = Join-Path "C:\pp\GemorProject\DataModele\QuizSystemCore" $folder
    if (Test-Path $fullPath) {
        try {
            $itemCount = (Get-ChildItem $fullPath -ErrorAction SilentlyContinue).Count
            Write-Host "  OK $folder ($itemCount ??????)" -ForegroundColor Green
        } catch {
            Write-Host "  OK $folder (????? ??????????)" -ForegroundColor Green
        }
    } else {
        Write-Host "  NO $folder (???????????)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== ? ? ? ===" -ForegroundColor Cyan

Write-Host ""
Write-Host "1. ?? ? ??:" -ForegroundColor Yellow
Write-Host "   .\setup-db-simple.bat" -ForegroundColor White

Write-Host ""
Write-Host "2. ? ?:" -ForegroundColor Yellow
Write-Host "   mkdir build -Force" -ForegroundColor White
Write-Host "   cd build" -ForegroundColor White
Write-Host '   cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_TOOLCHAIN_FILE=C:/vcpkg/scripts/buildsystems/vcpkg.cmake' -ForegroundColor White
Write-Host "   cmake --build . --config Release" -ForegroundColor White

Write-Host ""
Write-Host "3. ? ?:" -ForegroundColor Yellow
Write-Host "   .\bin\Release\quiz_system_core.exe" -ForegroundColor White

Write-Host ""
Write-Host "=== ???? ?? ===" -ForegroundColor Cyan

Write-Host ""
Write-Host "??? ?????????? ?? ???????:" -ForegroundColor Yellow
Write-Host "cd C:\vcpkg" -ForegroundColor White
Write-Host ".\vcpkg install cpprestsdk:x64-windows openssl:x64-windows spdlog:x64-windows fmt:x64-windows nlohmann-json:x64-windows" -ForegroundColor White

Write-Host ""
Write-Host "??? CMake ?? ??????? ??????????:" -ForegroundColor Yellow
Write-Host "??????? ? CMakeLists.txt ????? project():" -ForegroundColor White
Write-Host 'list(APPEND CMAKE_PREFIX_PATH "C:/vcpkg/installed/x64-windows")' -ForegroundColor White

Write-Host ""
Pause
