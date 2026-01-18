echo " ?"
echo "???: C:\pp\GemorProject\DataModele\QuizSystemCore"
echo ""

echo "?:"
if (Test-Path "CMakeLists.txt") { echo "  CMakeLists.txt - OK" } else { echo "  CMakeLists.txt - NO" }
if (Test-Path "README.md") { echo "  README.md - OK" } else { echo "  README.md - NO" }
if (Test-Path "setup-db-simple.bat") { echo "  setup-db-simple.bat - OK" } else { echo "  setup-db-simple.bat - NO" }

echo ""
echo ":"
if (Test-Path "src") { echo "  src - OK" } else { echo "  src - NO" }
if (Test-Path "include") { echo "  include - OK" } else { echo "  include - NO" }
if (Test-Path "database") { echo "  database - OK" } else { echo "  database - NO" }

echo ""
echo "? ?? ? ??:"
echo "  ???????? setup-db-simple.bat"
echo ""
echo "? ?:"
echo "  1. mkdir build"
echo "  2. cd build"
echo '  3. cmake .. -G "Visual Studio 17 2022" -A x64'
echo "  4. cmake --build . --config Release"
echo ""
pause
