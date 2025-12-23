 # Quiz System Core
>>
>> ## Описание проекта
>> Система тестирования и опросов на C++ с REST API и базой данных PostgreSQL.
>>
>> ## Структура проекта
>> QuizSystemCore/
>> ├── src/ # Исходный код C++
>> │ ├── core/ # Ядро системы
>> │ ├── api/ # API контроллеры
>> │ ├── models/ # Модели данных
>> │ ├── services/ # Бизнес-логика
>> │ ├── repositories/ # Репозитории БД
>> │ ├── utils/ # Вспомогательные функции
>> │ ├── middleware/ # Промежуточное ПО
>> │ └── database/ # Работа с БД
>> ├── include/ # Заголовочные файлы
>> ├── tests/ # Тесты
>> ├── config/ # Конфигурационные файлы
>> ├── database/ # Скрипты БД
>> ├── docs/ # Документация
>> ├── docker/ # Docker файлы
>> ├── scripts/ # Скрипты автоматизации
>> └── .vscode/ # Настройки VS Code
>>
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