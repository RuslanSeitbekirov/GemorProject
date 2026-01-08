// auth.js - обновленная версия для работы с API
class Auth {
    constructor() {
        this.API_BASE = 'http://localhost:3000/api';
        this.currentSession = null;
        this.init();
    }
    
    async init() {
        document.addEventListener('DOMContentLoaded', async () => {
            await this.checkSession();
            this.setupEventListeners();
        });
    }
    
    async checkSession() {
        try {
            const response = await fetch(`${this.API_BASE}/session/check`, {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.status === 'unknown') {
                this.handleUnknownUser();
            } else if (data.status === 'anonymous') {
                this.handleAnonymousUser(data);
            } else if (data.status === 'authorized') {
                this.currentSession = data;
                await this.handleAuthorizedUser();
            }
        } catch (error) {
            console.error('Session check error:', error);
            this.handleUnknownUser();
        }
    }
    
    handleUnknownUser() {
        const path = window.location.pathname;
        
        if (path.includes('Registration.html') || path.includes('login.html')) {
            return;
        }
        
        window.location.href = 'Registration.html';
    }
    
    handleAnonymousUser(sessionData) {
        // Логика для анонимных пользователей
        console.log('Anonymous user session');
    }
    
    async handleAuthorizedUser() {
        this.updateUserUI();
        
        if (window.location.pathname.includes('Registration.html') || 
            window.location.pathname.includes('login.html')) {
            window.location.href = 'index.html';
        }
        
        this.showMainInterface();
    }
    
    async login(email, password) {
        try {
            const response = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.status === 'needs_verification') {
                // Показываем форму верификации
                this.showVerificationForm(email, password);
                return data;
            }
            
            if (data.success) {
                // Сохраняем данные в localStorage
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                
                window.location.href = 'index.html';
            }
            
            return data;
        } catch (error) {
            console.error('Login error:', error);
            return { error: 'Network error' };
        }
    }
    
    async verifyEmail(email, code, password) {
        try {
            const response = await fetch(`${this.API_BASE}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                
                window.location.href = 'index.html';
            }
            
            return data;
        } catch (error) {
            console.error('Verification error:', error);
            return { error: 'Network error' };
        }
    }
    
    showVerificationForm(email, password) {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;
        
        mainContent.innerHTML = `
            <div class="verification-form">
                <h2>Подтверждение email</h2>
                <p>На адрес ${email} отправлен код подтверждения.</p>
                <p>Введите код:</p>
                <input type="text" id="verificationCode" maxlength="6" placeholder="123456">
                ${password ? `<p>Придумайте пароль:</p>
                <input type="password" id="newPassword" placeholder="Новый пароль">` : ''}
                <button onclick="auth.submitVerification('${email}', ${password ? `document.getElementById('newPassword').value` : `null`})">
                    Подтвердить
                </button>
            </div>
        `;
    }
    
    async submitVerification(email, password) {
        const code = document.getElementById('verificationCode').value;
        await this.verifyEmail(email, code, password);
    }
    
    async logout(allDevices = false) {
        try {
            await fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({ allDevices }),
                credentials: 'include'
            });
            
            localStorage.clear();
            window.location.href = 'Registration.html';
        } catch (error) {
            console.error('Logout error:', error);
            localStorage.clear();
            window.location.href = 'Registration.html';
        }
    }
    
    updateUserUI() {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        const usernameElement = document.getElementById('username');
        if (usernameElement && userData.username) {
            usernameElement.textContent = userData.username;
        }
        
        const displayUsername = document.getElementById('displayUsername');
        if (displayUsername && userData.username) {
            displayUsername.textContent = userData.username;
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
                        <button class="dashboard-btn" onclick="window.location.href='create-test.html'">
                            📝 Создать новый тест
                        </button>
                        <button class="dashboard-btn" onclick="window.location.href='my-tests.html'">
                            📚 Мои тесты
                        </button>
                        <button class="dashboard-btn" onclick="window.location.href='take-test.html'">
                            🎯 Пройти тест
                        </button>
                    </div>
                </div>
            `;
            
            this.updateUserUI();
        }
        
        document.getElementById('header').style.display = 'flex';
    }
    
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                const allDevices = e.target.getAttribute('title')?.includes('везде');
                this.logout(allDevices);
            }
        });
    }
}

// Глобальный экземпляр
const auth = new Auth();
window.auth = auth;