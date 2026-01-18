 # Quiz System Core
>>
>> ## Описание проекта
>> Система тестирования и опросов на C++ с REST API и базой данных PostgreSQL.
>>
>> ## Структура проекта
>>QuizSystemCore/
├── src/ # Исходный код C++
│ ├── core/ # Ядро системы
│ ├── api/ # API контроллеры
│ ├── models/ # Модели данных
│ ├── services/ # Бизнес-логика
│ ├── repositories/ # Репозитории БД
│ ├── utils/ # Вспомогательные функции
│ └── database/ # Работа с БД
├── include/ # Заголовочные файлы
├── tests/ # Тесты
│ ├── unit/ # Модульные тесты
│ └── integration/ # Интеграционные тесты
├── config/ # Конфигурационные файлы
├── database/ # Скрипты БД
├── docs/ # Документация
├── docker/ # Docker файлы
├── scripts/ # Скрипты автоматизации
└── .vscode/ # Настройки VS Code
## Введение

Quiz System Core - это система тестирования и опросов, написанная на C++ с использованием:
- **C++17** - современный стандарт C++
- **CMake** - система сборки
- **PostgreSQL** - база данных
- **cpprestsdk** - HTTP сервер и клиент
- **spdlog** - логирование
- **Google Test** - тестирование
- 
>> ## Требования
>> - Windows 10/11
>> - Visual Studio 2022 Build Tools
>> - PostgreSQL 18
>> - CMake 3.20+
>> - vcpkg
>> - Git
>>
>> ## Быстрый старт
>> ```bash
>> # 1. Клонируйте репозиторий
>> git clone <repository-url>
>> cd QuizSystemCore
>>
>> # 2. Установите зависимости
>> vcpkg install cpprestsdk:x64-windows libpq:x64-windows openssl:x64-windows
>>
>> # 3. Сконфигурируйте CMake
>> cmake -B build -G "Visual Studio 17 2022" -A x64
>>
>> # 4. Соберите проект
>> cmake --build build --config Release
>>
>> # 5. Инициализируйте БД
>> database\scripts\init_database.bat
>>
>> # 6. Запустите приложение
>> bin\quiz_system_core.exe

>>### Установка зависимостей
>>
>> ''' powershell
>> Установка зависимостей через vcpkg
>> cd C:\vcpkg
>> .\vcpkg install cpprestsdk:x64-windows libpq:x64-windows openssl:x64-windows jsoncpp:x64-windows spdlog:x64-windows fmt:x64-windows boost:x64-windows nlohmann-json:x64-windows gtest:x64-windows