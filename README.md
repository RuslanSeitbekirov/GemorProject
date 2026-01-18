<h1>beta 1.2</h1>
# Plagin community presents
![Plagin solved](for_readme/sad.png)


[![HTML](https://img.shields.io/badge/HTML-%23E34F26.svg?logo=html5&logoColor=white)](#)
[![CSS](https://img.shields.io/badge/CSS-639?logo=css&logoColor=fff)](#)
[![Go](https://img.shields.io/badge/Go-%2300ADD8.svg?&logo=go&logoColor=white)](#)
[![C++](https://img.shields.io/badge/C++-%2300599C.svg?logo=c%2B%2B&logoColor=white)](#)
[![CMAKE](https://img.shields.io/badge/cmake-%2300599C.svg?logo=cmake&logoColor=white)](#)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=fff)](#)
[![Deepseek](https://custom-icon-badges.demolab.com/badge/Conan_packages-4D6BFF?logo=conan&logoColor=fff)](#)

# Запуск проекта 
для запуска достаточно иметь установленный docker и docker compose
```
docker compose up
```
<h1>Alfa 1.9.3 - Alfa 1.9.4</h1>
Сайт был запущен на локальном сервере в Docker контейнере.
GemorProject/  
    public/
        ├── index.html
        ├── Registration.html
        ├── create-test.html
        ├── my-tests.html
        ├── take-test.html
        ├── Test.html
        ├── css/
        │   ├── RegStyle.css
        │   ├── TestStyle.css
        │   └── GENstyle.css
        ├── js/
        │   ├── sessionStore.js
        │   ├── auth.js
        │   ├── RegScript.js
        │   ├── testCreator.js
        │   └── test_main.js
        └── img/
            ├── Prof.jpg
            ├── YandexID.png
            └── github.png
    Сценарии.md
    docker-compose.yml
    package-lock.json
    package.json
    README.md
    server-old.js
    server.js

<h1>Alfa 1.9.2</h1>
Поправлены биги связаные с обработкой имитации деятельности. В основном для страницы регистрации
Проблема была в пути к js файлам отсутвовал указатель на папку.

Дальнейшая рабрта без базы данных невозможна. 
В около рабочем состоянии :
    Сайт регистрации. (JS считывает нажатия на кнопки, логин и пароль).
    Сайт для тестов имеется, но надо выгружать вопросы и ответы с базы данных.

Надо сделать (независимо от других модулей):
    Главную страницу. (без авторизации пустая)
    Страницу создания теста . (открывается, но сразу перекидывает на главную)
    Профиль пользователя.

Надо сделать (при участии других модулей):
    Регистрация в базе, авторизация.
    Сохранение тестов в базе.

<h1>Alfa 1.9</h1>

На стадии доработки


<h1>Alfa 1.1 </h1>
В около рабочем состоянии :
    Сайт регистрации. (JS считывает нажатия на кнопки, логин и пароль).
    Сайт для тестов имеется, но надо выгружать вопросы и ответы с базы данных.

Надо сделать (независимо от других модулей):
    Главную страницу.
    Страницу создания теста.
    Профиль пользователя.

Надо сделать (при участии других модулей):
    Регистрация в базе, авторизация.
    Сохранение тестов в базе.