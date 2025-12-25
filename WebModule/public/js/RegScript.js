// // RegScript.js - обновленный
// const loginButton = document.querySelector('.loginButton');
// const loginButtonYandex = document.querySelector('.loginButtonYandex');
// const loginButtonGithub = document.querySelector('.loginButtonGithub');

// // Функция для тестового входа
// function performTestLogin(login, password) {
//     if (login === "test" && password === "1410") {
//         // Создаем сессию
//         const sessionToken = 'session_' + Date.now();
//         const loginToken = 'login_' + Date.now();
        
//         // Сохраняем в sessionStore
//         if (typeof sessionStore !== 'undefined') {
//             sessionStore.createAnonymousSession(sessionToken, loginToken);
            
//             // Устанавливаем куку
//             document.cookie = `session_token=${sessionToken}; path=/; max-age=604800`;
            
//             // Имитируем успешную авторизацию
//             simulateOAuthSuccess('test', loginToken, sessionToken);
//         } else {
//             alert('Ошибка: sessionStore не загружен');
//         }
//         return true;
//     }
//     return false;
// }

// function showAccountNotFoundDialog(email, password) {
//     // Реализация диалога из предыдущего ответа
//     const dialogHTML = `
//         <div class="account-not-found-modal">
//             <div class="modal-content">
//                 <h3>Аккаунт не найден</h3>
//                 <p>Аккаунт с email "${email}" не существует.</p>
//                 <div class="modal-buttons">
//                     <button id="create-new-btn" class="btn btn-primary">Создать новый</button>
//                     <button id="try-again-btn" class="btn btn-secondary">Попробовать снова</button>
//                 </div>
//             </div>
//         </div>
//     `;
    
//     // Добавить отображение модального окна
// }

// function simulateOAuthSuccess(provider, loginToken, sessionToken) {
//     // Генерируем JWT токены
//     const accessToken = 'access_' + Date.now();
//     const refreshToken = 'refresh_' + Date.now();
    
//     const userData = {
//         id: 'test_user_123',
//         name: 'Тестовый пользователь',
//         email: 'test@example.com',
//         provider: 'test'
//     };
    
//     // Обновляем сессию
//     sessionStore.upgradeToAuthorized(sessionToken, accessToken, refreshToken, userData);
    
//     // Сохраняем в localStorage
//     localStorage.setItem('userId', userData.id);
//     localStorage.setItem('username', userData.name);
//     localStorage.setItem('userData', JSON.stringify(userData));
    
//     // Перенаправляем
//     window.location.href = '../General/index.html';
// }

// // Обработка выбора метода авторизации
// document.addEventListener('DOMContentLoaded', function() {
//     setupAuthButtons();
// });

// function setupAuthButtons() {
//     document.getElementById('login-form')?.addEventListener('submit', function(e) {
//         e.preventDefault();
//         const email = document.getElementById('email').value;
//         const password = document.getElementById('password').value;
        
//         // В реальности здесь будет запрос к API
//         console.log('Попытка входа:', email);
        
//         // Симуляция проверки
//         setTimeout(() => {
//             const users = JSON.parse(localStorage.getItem('users') || '[]');
//             const user = users.find(u => u.email === email && u.password === password);
            
//             if (user) {
//                 // Успешный вход
//                 localStorage.setItem('userState', 'authorized');
//                 localStorage.setItem('currentUser', JSON.stringify(user));
//                 window.location.href = 'index.html';
//             } else {
//                 // Показываем диалог "Аккаунт не найден"
//                 showAccountNotFoundDialog(email, password);
//             }
//         }, 1000);
//     });
// }

// // Обработчики OAuth
// loginButtonYandex.addEventListener('click', () => {
//     window.location.href = '../General/login.html?type=yandex';
// });

// loginButtonGithub.addEventListener('click', () => {
//     window.location.href = '../General/login.html?type=github';
// });

// // Обработка Enter
// document.getElementById('password').addEventListener('keypress', (e) => {
//     if (e.key === 'Enter') {
//         loginButton.click();
//     }
// });

// // Проверяем, если пользователь уже авторизован
// window.addEventListener('DOMContentLoaded', () => {
//     const sessionToken = getCookie('session_token');
//     if (sessionToken && typeof sessionStore !== 'undefined') {
//         const session = sessionStore.getSession(sessionToken);
//         if (session && session.status === 'authorized') {
//             window.location.href = '../General/index.html';
//         }
//     }
// });

// function getCookie(name) {
//     const value = `; ${document.cookie}`;
//     const parts = value.split(`; ${name}=`);
//     if (parts.length === 2) return parts.pop().split(';').shift();
//     return null;
// }


// RegScript.js - упрощенная версия для тестового входа
document.addEventListener('DOMContentLoaded', function() {
    console.log('Registration page loaded');
    
    const loginButton = document.querySelector('.loginButton');
    const loginButtonYandex = document.querySelector('.loginButtonYandex');
    const loginButtonGithub = document.querySelector('.loginButtonGithub');
    
    // Заменяем Yandex ID на GitHub на кнопке
    const githubButton = document.querySelector('.loginButtonGithub');
    if (githubButton) {
        githubButton.innerHTML = '<img src="img/YandexID.png" alt="Иконка" class="Yandex-icon"> Войти c GitHub';
    }
    
    // Проверяем, если пользователь уже авторизован
    checkExistingSession();
    
    // Обработчик для тестового входа
    loginButton.addEventListener('click', function() {
        console.log('Нажата кнопка "Войти"');
        
        const login = document.getElementById('login').value;
        const password = document.getElementById('password').value;
        
        console.log('Введены данные:', { login, password: '***' });
        
        // Проверяем тестовый логин
        if (login === "test" && password === "1410") {
            console.log('✓ Тестовые данные верны');
            console.log('[Имитация] Запрос к API авторизации...');
            
            // Создаем сессию
            const sessionToken = 'session_' + Date.now();
            const loginToken = 'login_' + Date.now();
            
            console.log('[Имитация] Генерируем токены:');
            console.log('  - Токен сессии:', sessionToken);
            console.log('  - Токен входа:', loginToken);
            
            // Сохраняем в sessionStore
            if (typeof sessionStore !== 'undefined') {
                console.log('[Имитация] Сохраняем в Redis (имитация):');
                console.log('  - Ключ:', sessionToken);
                console.log('  - Значение: {status: "anonymous", loginToken: "' + loginToken + '"}');
                
                sessionStore.createAnonymousSession(sessionToken, loginToken);
                
                // Устанавливаем куку
                document.cookie = `session_token=${sessionToken}; path=/; max-age=604800`;
                console.log('[Имитация] Устанавливаем куку session_token');
                
                // Имитируем успешную авторизацию
                simulateOAuthSuccess('test', loginToken, sessionToken);
            } else {
                console.error('SessionStore не загружен');
                alert('Ошибка: sessionStore не загружен');
            }
        } else {
            console.log('✗ Неверные данные для тестового входа');
            console.log('[Имитация] Запрос к базе данных...');
            console.log('[Имитация] Ответ: аккаунт не найден');
            
            // Показываем диалог "Аккаунт не найден"
            showAccountNotFoundDialog(login, password);
        }
    });
    
    // Обработчики OAuth кнопок
    loginButtonYandex.addEventListener('click', function() {
        console.log('Нажата кнопка Яндекс ID');
        console.log('[Имитация] Перенаправление на OAuth Яндекс');
        window.location.href = 'login.html?type=yandex';
    });
    
    loginButtonGithub.addEventListener('click', function() {
        console.log('Нажата кнопка GitHub');
        console.log('[Имитация] Перенаправление на OAuth GitHub');
        window.location.href = 'login.html?type=github';
    });
    
    // Обработка Enter в поле пароля
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            console.log('Нажата клавиша Enter в поле пароля');
            loginButton.click();
        }
    });
});

function checkExistingSession() {
    const sessionToken = getCookie('session_token');
    if (sessionToken && typeof sessionStore !== 'undefined') {
        console.log('Найдена существующая сессия:', sessionToken.substring(0, 20) + '...');
        
        const session = sessionStore.getSession(sessionToken);
        if (session && session.status === 'authorized') {
            console.log('Пользователь уже авторизован, перенаправляем...');
            window.location.href = '../General/index.html';
        } else if (session && session.status === 'anonymous') {
            console.log('Пользователь анонимный, остаемся на странице регистрации');
        }
    } else {
        console.log('Активной сессии не найдено');
    }
}

function showAccountNotFoundDialog(email, password) {
    console.log('[Имитация] Показываем диалог "Аккаунт не найден"');
    
    const dialogHTML = `
        <div class="account-not-found-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        ">
            <div class="modal-content" style="
                background: white;
                padding: 20px;
                border-radius: 10px;
                width: 300px;
                text-align: center;
            ">
                <h3 style="color: #d32f2f;">Аккаунт не найден</h3>
                <p>Аккаунт с логином "${email}" не существует.</p>
                <div style="margin-top: 20px;">
                    <button id="create-new-btn" style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        margin: 5px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Создать новый</button>
                    <button id="try-again-btn" style="
                        background: #f44336;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        margin: 5px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Попробовать снова</button>
                </div>
            </div>
        </div>
    `;
    
    const dialog = document.createElement('div');
    dialog.innerHTML = dialogHTML;
    document.body.appendChild(dialog);
    
    // Обработчики кнопок диалога
    document.getElementById('create-new-btn').addEventListener('click', function() {
        console.log('[Имитация] Нажата кнопка "Создать новый"');
        console.log('[Имитация] Создание нового профиля...');
        
        // Удаляем диалог
        dialog.remove();
        
        // Создаем тестового пользователя
        createNewAccount(email, password);
    });
    
    document.getElementById('try-again-btn').addEventListener('click', function() {
        console.log('[Имитация] Нажата кнопка "Попробовать снова"');
        dialog.remove();
    });
}

function createNewAccount(email, password) {
    console.log('[Имитация] Создание нового аккаунта:', email);
    
    // Создаем сессию для нового пользователя
    const sessionToken = 'session_' + Date.now();
    const loginToken = 'login_' + Date.now();
    
    console.log('[Имитация] Генерируем токены для нового пользователя');
    
    // Сохраняем в sessionStore
    if (typeof sessionStore !== 'undefined') {
        sessionStore.createAnonymousSession(sessionToken, loginToken);
        
        // Устанавливаем куку
        document.cookie = `session_token=${sessionToken}; path=/; max-age=604800`;
        
        // Создаем данные пользователя
        const userData = {
            id: 'user_' + Date.now(),
            name: email.split('@')[0] || 'Новый пользователь',
            email: email,
            provider: 'credentials'
        };
        
        // Генерируем JWT токены
        const accessToken = 'access_' + Date.now();
        const refreshToken = 'refresh_' + Date.now();
        
        // Обновляем сессию до авторизованной
        sessionStore.upgradeToAuthorized(sessionToken, accessToken, refreshToken, userData);
        
        // Сохраняем в localStorage
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('username', userData.name);
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('userState', 'authorized');
        
        console.log('[Имитация] Новый профиль создан, перенаправляем...');
        
        // Перенаправляем на главную
        setTimeout(() => {
            window.location.href = '../General/index.html';
        }, 1000);
    }
}

function simulateOAuthSuccess(provider, loginToken, sessionToken) {
    console.log('[Имитация OAuth] Доступ предоставлен через', provider);
    
    // Генерируем JWT токены
    const accessToken = 'access_' + Date.now();
    const refreshToken = 'refresh_' + Date.now();
    
    console.log('[Имитация] Генерируем JWT токены:');
    console.log('  - Access Token:', accessToken);
    console.log('  - Refresh Token:', refreshToken);
    
    const userData = {
        id: 'test_user_123',
        name: 'Тестовый пользователь',
        email: 'test@example.com',
        provider: 'test'
    };
    
    // Обновляем сессию
    console.log('[Имитация] Обновляем сессию в Redis:');
    console.log('  - Ключ:', sessionToken);
    console.log('  - Новый статус: authorized');
    
    sessionStore.upgradeToAuthorized(sessionToken, accessToken, refreshToken, userData);
    
    // Сохраняем в localStorage
    localStorage.setItem('userId', userData.id);
    localStorage.setItem('username', userData.name);
    localStorage.setItem('userData', JSON.stringify(userData));
    localStorage.setItem('userState', 'authorized');
    
    console.log('[Имитация] Сохраняем в localStorage');
    console.log('[Имитация] Перенаправляем на главную...');
    
    // Перенаправляем
    setTimeout(() => {
        window.location.href = '../General/index.html';
    }, 1000);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}