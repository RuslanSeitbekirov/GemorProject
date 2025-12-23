# ============================================
# ИСПРАВЛЕННЫЙ CMakeLists.txt
# ============================================

cmake_minimum_required(VERSION 3.20)
project(QuizSystemCore VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================
# ЯВНО УКАЗЫВАЕМ ПУТЬ К VCPKG
# ============================================

if(DEFINED ENV{VCPKG_ROOT})
    set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake")
    message(STATUS "✅ Использую vcpkg из переменной окружения")
    
elseif(EXISTS "C:/vcpkg/scripts/buildsystems/vcpkg.cmake")
    set(CMAKE_TOOLCHAIN_FILE "C:/vcpkg/scripts/buildsystems/vcpkg.cmake")
    message(STATUS "✅ Использую vcpkg из стандартного пути")
    
else()
    message(FATAL_ERROR "❌ vcpkg не найден!")
endif()

# ============================================
# ДОБАВЛЯЕМ ПУТИ ДЛЯ ПОИСКА БИБЛИОТЕК
# ============================================

list(APPEND CMAKE_PREFIX_PATH "C:/vcpkg/installed/x64-windows")

# ============================================
# ПОИСК БИБЛИОТЕК
# ============================================

message(STATUS "🔍 Ищу библиотеки...")

# Ищем библиотеки
find_package(cpprestsdk CONFIG REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(spdlog CONFIG REQUIRED)
find_package(fmt CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)

message(STATUS "✅ cpprestsdk найден")
message(STATUS "✅ OpenSSL найден")
message(STATUS "✅ spdlog найден")
message(STATUS "✅ fmt найден")
message(STATUS "✅ nlohmann_json найден")

# ============================================
# СОЗДАЕМ ИСПОЛНЯЕМЫЙ ФАЙЛ
# ============================================

add_executable(quiz_system_core)

# Ищем исходные файлы
file(GLOB_RECURSE SOURCE_FILES "src/*.cpp")

if(SOURCE_FILES)
    message(STATUS "📄 Найдено файлов: ${SOURCE_FILES}")
    target_sources(quiz_system_core PRIVATE ${SOURCE_FILES})
else()
    # Создаем минимальный пример
    message(STATUS "📄 Создаю минимальный пример...")
    
    file(WRITE ${CMAKE_CURRENT_SOURCE_DIR}/src/minimal.cpp
        "#include <iostream>\n"
        "#include <cpprest/http_listener.h>\n"
        "#include <cpprest/json.h>\n"
        "\n"
        "using namespace web;\n"
        "using namespace web::http;\n"
        "using namespace web::http::experimental::listener;\n"
        "\n"
        "void handle_get(http_request request) {\n"
        "    json::value response;\n"
        "    response[U(\"message\")] = json::value::string(U(\"Hello from Quiz System!\"));\n"
        "    response[U(\"status\")] = json::value::string(U(\"success\"));\n"
        "    \n"
        "    request.reply(status_codes::OK, response);\n"
        "}\n"
        "\n"
        "int main() {\n"
        "    std::cout << \"🚀 Запуск Quiz System Core...\" << std::endl;\n"
        "    \n"
        "    // Создаем HTTP listener\n"
        "    http_listener listener(U(\"http://localhost:8080\"));\n"
        "    listener.support(methods::GET, handle_get);\n"
        "    \n"
        "    try {\n"
        "        // Запускаем listener\n"
        "        listener.open().wait();\n"
        "        std::cout << \"✅ Сервер запущен на http://localhost:8080\" << std::endl;\n"
        "        std::cout << \"📌 Нажмите Enter для остановки...\" << std::endl;\n"
        "        \n"
        "        // Ждем нажатия Enter\n"
        "        std::cin.get();\n"
        "        \n"
        "        // Останавливаем listener\n"
        "        listener.close().wait();\n"
        "        std::cout << \"👋 Сервер остановлен\" << std::endl;\n"
        "        \n"
        "    } catch (const std::exception& e) {\n"
        "        std::cerr << \"❌ Ошибка: \" << e.what() << std::endl;\n"
        "        return 1;\n"
        "    }\n"
        "    \n"
        "    return 0;\n"
        "}\n"
    )
    
    target_sources(quiz_system_core PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src/minimal.cpp)
endif()

# ============================================
# НАСТРОЙКА ВКЛЮЧЕНИЙ И БИБЛИОТЕК
# ============================================

target_include_directories(quiz_system_core PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    "C:/vcpkg/installed/x64-windows/include"
)

# ============================================
# ИСПРАВЛЕННАЯ СТРОКА С БИБЛИОТЕКАМИ
# ============================================

target_link_libraries(quiz_system_core PRIVATE
    cpprestsdk::cpprest      # ⚠️ ИСПРАВЛЕНО: cpprestsdk::cpprest
    OpenSSL::SSL
    OpenSSL::Crypto
    spdlog::spdlog
    fmt::fmt
    nlohmann_json::nlohmann_json
)

# Для Windows
if(WIN32)
    target_link_libraries(quiz_system_core PRIVATE
        ws2_32
        crypt32
    )
endif()

# ============================================
# НАСТРОЙКА ВЫХОДНЫХ ПУТЕЙ
# ============================================

set_target_properties(quiz_system_core PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/bin
    RUNTIME_OUTPUT_DIRECTORY_DEBUG ${CMAKE_CURRENT_SOURCE_DIR}/bin/debug
    RUNTIME_OUTPUT_DIRECTORY_RELEASE ${CMAKE_CURRENT_SOURCE_DIR}/bin/release
)

# Создаем выходные директории
file(MAKE_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/bin)
file(MAKE_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/bin/debug)
file(MAKE_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/bin/release)

# ============================================
# ФИНАЛЬНОЕ СООБЩЕНИЕ
# ============================================

message(STATUS "")
message(STATUS "🎉 КОНФИГУРАЦИЯ УСПЕШНА!")
message(STATUS "📁 Путь проекта: C:\\pp\\GemorProject\\DataModele\\QuizSystemCore")
message(STATUS "📁 Выходная папка: ${CMAKE_CURRENT_SOURCE_DIR}\\bin")
message(STATUS "📦 Подключенные библиотеки:")
message(STATUS "   - cpprestsdk::cpprest (HTTP сервер)")
message(STATUS "   - OpenSSL (шифрование)")
message(STATUS "   - spdlog (логирование)")
message(STATUS "   - fmt (форматирование строк)")
message(STATUS "   - nlohmann_json (работа с JSON)")
message(STATUS "")
message(STATUS "🚀 Для сборки выполните: cmake --build . --config Release")
message(STATUS "🌐 Сервер будет доступен: http://localhost:8080")
message(STATUS "")
if(WIN32)
    # Для Windows используем powershell, а не pwsh
    find_program(POWERSHELL_EXE powershell.exe)
    if(POWERSHELL_EXE)
        add_custom_command(TARGET quiz_system_core POST_BUILD
            COMMAND ${POWERSHELL_EXE} -Command "Write-Host '✅ Сборка завершена' -ForegroundColor Green"
            COMMENT "Post-build message"
        )
    endif()
endif()