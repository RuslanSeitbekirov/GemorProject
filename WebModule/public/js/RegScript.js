// RegScript.js - обновленная версия для работы с тестовыми данными
document.addEventListener('DOMContentLoaded', function() {
    console.log('Registration page loaded');
    
    const loginButton = document.querySelector('.loginButton');
    const loginButtonYandex = document.querySelector('.loginButtonYandex');
    const loginButtonGithub = document.querySelector('.loginButtonGithub');
    
    // Проверяем, если пользователь уже авторизован
    checkExistingSession();
    
    // Обработчик для тестового входа
    loginButton.addEventListener('click', function() {
        console.log('=== Попытка входа ===');
        
        const login = document.getElementById('login').value;
        const password = document.getElementById('password').value;
        
        console.log('Введены данные:', { login, password: password ? '***' : '(пусто)' });
        
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
        console.log('[Имитация] Создание анонимной сессии для OAuth...');
        
        // Создаем сессию для анонимного пользователя
        const sessionToken = 'session_' + Date.now();
        const loginToken = 'login_' + Date.now();
        
        sessionStore.createAnonymousSession(sessionToken, loginToken);
        document.cookie = `session_token=${sessionToken}; path=/; max-age=604800`;
        
        // Имитируем OAuth процесс для Яндекс
        simulateOAuthProcess('yandex', loginToken, sessionToken);
    });
    
    loginButtonGithub.addEventListener('click', function() {
        console.log('Нажата кнопка GitHub');
        console.log('[Имитация] Создание анонимной сессии для OAuth...');
        
        // Создаем сессию для анонимного пользователя
        const sessionToken = 'session_' + Date.now();
        const loginToken = 'login_' + Date.now();
        
        sessionStore.createAnonymousSession(sessionToken, loginToken);
        document.cookie = `session_token=${sessionToken}; path=/; max-age=604800`;
        
        // Имитируем OAuth процесс для GitHub
        simulateOAuthProcess('github', loginToken, sessionToken);
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
            window.location.href = 'index.html';
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
            window.location.href = 'index.html';
        }, 1000);
    }
}

function simulateOAuthProcess(provider, loginToken, sessionToken) {
    console.log('[Имитация] Запуск OAuth процесса для', provider);
    
    // Имитация подтверждения OAuth
    const confirmed = confirm(`Разрешить доступ к вашим данным через ${provider}?`);
    
    if (confirmed) {
        simulateOAuthSuccess(provider, loginToken, sessionToken);
    } else {
        console.log('[Имитация] Пользователь отказал в доступе');
        
        // Удаляем сессию
        sessionStore.deleteSession(sessionToken);
        document.cookie = `session_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
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
    
    const userData = provider === 'test' ? {
        id: 'test_user_123',
        name: 'Тестовый пользователь',
        email: 'test@example.com',
        provider: 'test'
    } : {
        id: `${provider}_user_${Date.now()}`,
        name: provider === 'yandex' ? 'Яндекс Пользователь' : 'GitHub Пользователь',
        email: `${provider}_user@example.com`,
        provider: provider
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
        window.location.href = 'index.html';
    }, 1000);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}