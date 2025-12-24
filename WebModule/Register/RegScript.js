// RegScript.js - обновленный
const loginButton = document.querySelector('.loginButton');
const loginButtonYandex = document.querySelector('.loginButtonYandex');
const loginButtonGithub = document.querySelector('.loginButtonGithub');

// Функция для тестового входа
function performTestLogin(login, password) {
    if (login === "test" && password === "1410") {
        // Создаем сессию
        const sessionToken = 'session_' + Date.now();
        const loginToken = 'login_' + Date.now();
        
        // Сохраняем в sessionStore
        if (typeof sessionStore !== 'undefined') {
            sessionStore.createAnonymousSession(sessionToken, loginToken);
            
            // Устанавливаем куку
            document.cookie = `session_token=${sessionToken}; path=/; max-age=604800`;
            
            // Имитируем успешную авторизацию
            simulateOAuthSuccess('test', loginToken, sessionToken);
        } else {
            alert('Ошибка: sessionStore не загружен');
        }
        return true;
    }
    return false;
}

function simulateOAuthSuccess(provider, loginToken, sessionToken) {
    // Генерируем JWT токены
    const accessToken = 'access_' + Date.now();
    const refreshToken = 'refresh_' + Date.now();
    
    const userData = {
        id: 'test_user_123',
        name: 'Тестовый пользователь',
        email: 'test@example.com',
        provider: 'test'
    };
    
    // Обновляем сессию
    sessionStore.upgradeToAuthorized(sessionToken, accessToken, refreshToken, userData);
    
    // Сохраняем в localStorage
    localStorage.setItem('userId', userData.id);
    localStorage.setItem('username', userData.name);
    localStorage.setItem('userData', JSON.stringify(userData));
    
    // Перенаправляем
    window.location.href = '../General/index.html';
}

// Обработчик обычного входа
loginButton.addEventListener('click', () => {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    
    if (!login || !password) {
        alert('Заполните все поля');
        return;
    }
    
    if (performTestLogin(login, password)) {
        // Успешный вход обрабатывается в функции
    } else {
        alert('Неверный логин или пароль. Используйте test / 1410');
    }
});

// Обработчики OAuth
loginButtonYandex.addEventListener('click', () => {
    window.location.href = '../General/login.html?type=yandex';
});

loginButtonGithub.addEventListener('click', () => {
    window.location.href = '../General/login.html?type=github';
});

// Обработка Enter
document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginButton.click();
    }
});

// Проверяем, если пользователь уже авторизован
window.addEventListener('DOMContentLoaded', () => {
    const sessionToken = getCookie('session_token');
    if (sessionToken && typeof sessionStore !== 'undefined') {
        const session = sessionStore.getSession(sessionToken);
        if (session && session.status === 'authorized') {
            window.location.href = '../General/index.html';
        }
    }
});

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}