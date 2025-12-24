// auth.js - финальная версия с поддержкой всех статусов
class Auth {
    constructor() {
        this.SESSION_COOKIE_NAME = 'session_token';
        this.currentSession = null;
        this.init();
    }
    
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.checkSession();
            this.setupEventListeners();
        });
    }
    
    checkSession() {
        const sessionToken = this.getCookie(this.SESSION_COOKIE_NAME);
        
        if (!sessionToken) {
            console.log('Статус: Неизвестный пользователь');
            this.handleUnknownUser();
            return;
        }
        
        // Имитация запроса к Redis через WebClient
        const session = sessionStore.getSession(sessionToken);
        
        if (!session) {
            console.log('Сессия не найдена в Redis');
            this.deleteCookie(this.SESSION_COOKIE_NAME);
            this.handleUnknownUser();
            return;
        }
        
        this.currentSession = { ...session, sessionToken };
        
        if (session.expiresAt < Date.now()) {
            console.log('Сессия истекла');
            sessionStore.deleteSession(sessionToken);
            this.deleteCookie(this.SESSION_COOKIE_NAME);
            this.handleUnknownUser();
            return;
        }
        
        console.log(`Статус пользователя: ${session.status}`);
        
        switch (session.status) {
            case 'anonymous':
                this.handleAnonymousUser();
                break;
            case 'authorized':
                this.handleAuthorizedUser();
                break;
            default:
                this.handleUnknownUser();
        }
    }
    
    handleUnknownUser() {
        const path = window.location.pathname;
        
        if (path === '/' || path.includes('index.html')) {
            this.showLoginPage();
        } else if (path.includes('/login')) {
            const urlParams = new URLSearchParams(window.location.search);
            const type = urlParams.get('type');
            
            if (type) {
                // Создаем новую сессию
                const sessionToken = this.generateToken();
                const loginToken = this.generateToken();
                
                // Сохраняем в Redis (имитация)
                sessionStore.createAnonymousSession(sessionToken, loginToken);
                
                // Устанавливаем куку
                this.setCookie(this.SESSION_COOKIE_NAME, sessionToken);
                
                // Перенаправляем на OAuth провайдера (имитация)
                console.log(`OAuth с ${type}, токен: ${loginToken}`);
                setTimeout(() => {
                    // Имитация OAuth callback
                    this.simulateOAuthCallback(type, loginToken);
                }, 1000);
            } else {
                window.location.href = 'index.html';
            }
        } else {
            window.location.href = 'index.html';
        }
    }
    
    handleAnonymousUser() {
        const path = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        
        if (path.includes('/login') && urlParams.get('type')) {
            const type = urlParams.get('type');
            
            // Генерируем новый токен входа
            const newLoginToken = this.generateToken();
            
            // Обновляем в Redis
            sessionStore.updateLoginToken(this.currentSession.loginToken, {
                loginToken: newLoginToken,
                updatedAt: Date.now()
            });
            
            // Перенаправляем на OAuth (имитация)
            console.log(`Обновление OAuth для ${type}, новый токен: ${newLoginToken}`);
            this.simulateOAuthCallback(type, newLoginToken);
        } else if (path.includes('/login')) {
            // Проверяем токен входа
            this.checkLoginToken();
        } else {
            window.location.href = 'index.html';
        }
    }
    
    handleAuthorizedUser() {
        // Обновляем UI
        this.updateUserUI();
        
        // Показываем основной интерфейс
        this.showMainInterface();
        
        // Обрабатываем специальные URL
        this.handleAuthorizedURLs();
    }
    
    handleAuthorizedURLs() {
        const path = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        
        if (path.includes('/logout')) {
            const allDevices = urlParams.get('all') === 'true';
            this.handleLogout(allDevices);
        } else if (path.includes('/login')) {
            window.location.href = 'index.html';
        }
    }
    
    simulateOAuthCallback(provider, loginToken) {
        // Имитация OAuth процесса
        const confirmed = confirm(`Разрешить доступ к вашим данным ${provider}?`);
        
        if (confirmed) {
            // Доступ предоставлен
            this.processOAuthSuccess(provider, loginToken);
        } else {
            // Доступ отказан
            this.processOAuthDenied(loginToken);
        }
    }
    
    processOAuthSuccess(provider, loginToken) {
        // Проверяем токен входа
        const tokenData = sessionStore.getLoginToken(loginToken);
        
        if (!tokenData) {
            alert('Токен входа не найден или истек');
            sessionStore.deleteSession(this.currentSession.sessionToken);
            this.deleteCookie(this.SESSION_COOKIE_NAME);
            window.location.href = 'index.html';
            return;
        }
        
        // Генерируем JWT токены
        const accessToken = this.generateJWT({ type: 'access', provider });
        const refreshToken = this.generateJWT({ type: 'refresh', provider });
        
        // Данные пользователя
        const userData = {
            id: `user_${Date.now()}`,
            name: provider === 'yandex' ? 'Яндекс Пользователь' : 
                  provider === 'github' ? 'GitHub Пользователь' : 'Тестовый пользователь',
            email: `${provider}_user@example.com`,
            provider: provider
        };
        
        // Обновляем сессию
        sessionStore.upgradeToAuthorized(
            tokenData.sessionToken,
            accessToken,
            refreshToken,
            userData
        );
        
        // Обновляем локальное хранилище
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('username', userData.name);
        localStorage.setItem('userData', JSON.stringify(userData));
        
        // Перенаправляем на главную
        window.location.href = 'index.html';
    }
    
    processOAuthDenied(loginToken) {
        const tokenData = sessionStore.getLoginToken(loginToken);
        if (tokenData) {
            sessionStore.deleteSession(tokenData.sessionToken);
        }
        this.deleteCookie(this.SESSION_COOKIE_NAME);
        window.location.href = 'index.html';
    }
    
    checkLoginToken() {
        if (this.currentSession && this.currentSession.loginToken) {
            const tokenData = sessionStore.getLoginToken(this.currentSession.loginToken);
            
            if (!tokenData) {
                // Токен не найден
                sessionStore.deleteSession(this.currentSession.sessionToken);
                this.deleteCookie(this.SESSION_COOKIE_NAME);
                window.location.href = 'index.html';
            }
        }
    }
    
    handleLogout(allDevices = false) {
        const sessionToken = this.getCookie(this.SESSION_COOKIE_NAME);
        
        if (sessionToken) {
            sessionStore.deleteSession(sessionToken);
            this.deleteCookie(this.SESSION_COOKIE_NAME);
            
            if (allDevices && this.currentSession && this.currentSession.refreshToken) {
                // Имитация выхода со всех устройств
                console.log('Выход со всех устройств');
                // Здесь должен быть запрос к модулю авторизации
            }
        }
        
        localStorage.clear();
        window.location.href = 'index.html';
    }
    
    showLoginPage() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="login-page">
                    <h1>Добро пожаловать в систему тестирования</h1>
                    <p>Пожалуйста, авторизуйтесь для доступа к системе</p>
                    
                    <div class="auth-options">
                        <button class="auth-btn yandex" onclick="auth.startLogin('yandex')">
                            <img src="../img/YandexID.png" alt="Yandex"> Войти с Яндекс ID
                        </button>
                        
                        <button class="auth-btn github" onclick="auth.startLogin('github')">
                            <img src="../img/github.png" alt="GitHub"> Войти с GitHub
                        </button>
                        
                        <div class="test-login">
                            <h3>Тестовый вход:</h3>
                            <button class="auth-btn test" onclick="auth.startTestLogin()">
                                Логин: test, Пароль: 1410
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    showMainInterface() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="dashboard">
                    <h1>Личный кабинет</h1>
                    <div class="user-info">
                        <p>Добро пожаловать, <span id="displayUsername"></span>!</p>
                        <p>Статус: <span class="status-badge authorized">Авторизован</span></p>
                    </div>
                    
                    <div class="dashboard-actions">
                        <button class="dashboard-btn" onclick="window.location.href='index.html?action=create_test'">
                            📝 Создать новый тест
                        </button>
                        <button class="dashboard-btn" onclick="window.location.href='index.html?action=my_tests'">
                            📚 Мои тесты
                        </button>
                        <button class="dashboard-btn" onclick="window.location.href='../Test/Test.html'">
                            🎯 Пройти тест
                        </button>
                    </div>
                </div>
            `;
            
            // Загружаем создатель тестов если нужно
            const urlParams = new URLSearchParams(window.location.search);
            const action = urlParams.get('action');
            
            if (action === 'create_test') {
                this.loadTestCreator();
            } else if (action === 'my_tests') {
                this.loadMyTests();
            }
        }
        
        // Показываем шапку
        document.getElementById('header').style.display = 'flex';
    }
    
    loadTestCreator() {
        // Динамически загружаем интерфейс создания тестов
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML += `
                <div id="testCreatorContainer"></div>
            `;
            
            // Инициализируем создатель тестов
            if (typeof testCreator !== 'undefined') {
                // Уже инициализирован
            }
        }
    }
    
    loadMyTests() {
        // Загружаем список тестов пользователя
        if (typeof testCreator !== 'undefined') {
            testCreator.loadMyTests();
        }
    }
    
    startLogin(provider) {
        window.location.href = `login.html?type=${provider}`;
    }
    
    startTestLogin() {
        window.location.href = `login.html?type=test`;
    }
    
    updateUserUI() {
        if (this.currentSession && this.currentSession.userData) {
            const user = this.currentSession.userData;
            
            // Обновляем имя в шапке
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                usernameElement.textContent = user.name;
            }
            
            // Обновляем отображаемое имя
            const displayUsername = document.getElementById('displayUsername');
            if (displayUsername) {
                displayUsername.textContent = user.name;
            }
            
            // Обновляем статус
            const statusIndicator = document.getElementById('statusIndicator');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator status-${this.currentSession.status}`;
                statusIndicator.textContent = this.currentSession.status === 'authorized' ? 
                    'Авторизован' : 'Анонимный';
            }
        }
    }
    
    generateToken() {
        return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateJWT(payload) {
        // Простая имитация JWT
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payloadEncoded = btoa(JSON.stringify(payload));
        const signature = 'signature_' + Date.now();
        return `${header}.${payloadEncoded}.${signature}`;
    }
    
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    setCookie(name, value, days = 7) {
        const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${name}=${value}; expires=${expires}; path=/`;
    }
    
    deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
    
    setupEventListeners() {
        // Кнопка выхода
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                const allDevices = e.target.getAttribute('title')?.includes('везде');
                this.handleLogout(allDevices);
            }
        });
    }
}

// Глобальный экземпляр
let auth;
document.addEventListener('DOMContentLoaded', () => {
    auth = new Auth();
    window.auth = auth;
});