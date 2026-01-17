// auth.js - обновленная версия
class Auth {
    constructor() {
        this.API_BASE = '/api'; // Используем относительный путь через Nginx
        this.currentSession = null;
        this.init();
    }
    
    async init() {
        // Проверяем сессию при загрузке
        await this.checkSession();
    }
    
    async checkSession() {
        try {
            const response = await fetch(`${this.API_BASE}/session/check`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.currentSession = data;
            
            if (data.status === 'unknown') {
                this.handleUnknownUser();
            } else if (data.status === 'anonymous') {
                this.handleAnonymousUser(data);
            } else if (data.status === 'authorized') {
                await this.handleAuthorizedUser();
            }
            
            return data;
        } catch (error) {
            console.error('Session check error:', error);
            this.handleUnknownUser();
            return { status: 'unknown' };
        }
    }
    
    handleUnknownUser() {
        const path = window.location.pathname;
        
        if (path.includes('Registration.html') || path.includes('login.html')) {
            return;
        }
        
        // Создаем анонимную сессию для новых пользователей
        this.createAnonymousSession();
    }
    
    async createAnonymousSession() {
        try {
            const response = await fetch(`${this.API_BASE}/session/create`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.status === 'anonymous') {
                this.currentSession = data;
                this.updateUI();
            }
        } catch (error) {
            console.error('Create anonymous session error:', error);
        }
    }
    
    handleAnonymousUser(sessionData) {
        console.log('Anonymous user session:', sessionData);
        this.updateUI();
    }
    
    async handleAuthorizedUser() {
        this.updateUI();
        
        // Перенаправляем с страниц авторизации
        if (window.location.pathname.includes('Registration.html') || 
            window.location.pathname.includes('login.html')) {
            window.location.href = 'index.html';
        }
    }
    
    async login(email, password) {
        try {
            // Обработка администратора
            if (email.toLowerCase() === 'admin' && password === '1410') {
                email = 'admin@test.com';
                password = '1410';
            }
            
            const response = await fetch(`${this.API_BASE}/auth/email-login`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.status === 'needs_verification') {
                this.showVerificationForm(email, password);
                return data;
            }
            
            if (data.success) {
                // Обновляем сессию до авторизованной
                await this.upgradeSession(data.accessToken, data.refreshToken, data.user);
                
                // Обновляем UI
                this.updateUI();
                
                // Перенаправляем на главную
                window.location.href = 'index.html';
            } else if (data.error) {
                alert('Ошибка входа: ' + data.error);
            }
            
            return data;
        } catch (error) {
            console.error('Login error:', error);
            alert('Ошибка сети при входе');
            return { error: 'Ошибка сети' };
        }
    }
    
    async upgradeSession(accessToken, refreshToken, userData) {
        try {
            const response = await fetch(`${this.API_BASE}/session/upgrade`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionToken: this.currentSession?.sessionToken,
                    accessToken,
                    refreshToken,
                    userData
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentSession = data.session;
                this.updateUI();
            }
        } catch (error) {
            console.error('Upgrade session error:', error);
        }
    }
    
    async logout(allDevices = false) {
        try {
            const body = {};
            
            if (allDevices && this.currentSession?.refreshToken) {
                body.refreshToken = this.currentSession.refreshToken;
            }
            
            await fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                credentials: 'include'
            });
            
            // Удаляем сессию на клиенте
            await fetch(`${this.API_BASE}/session/delete`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionToken: this.currentSession?.sessionToken
                }),
                credentials: 'include'
            });
            
            // Очищаем локальное хранилище
            localStorage.clear();
            sessionStorage.clear();
            
            // Перенаправляем на страницу авторизации
            window.location.href = 'Registration.html';
            
        } catch (error) {
            console.error('Logout error:', error);
            // Все равно очищаем
            localStorage.clear();
            window.location.href = 'Registration.html';
        }
    }
    
    updateUI() {
        const userData = this.currentSession?.userData;
        
        // Обновляем шапку
        const header = document.getElementById('header');
        if (header) {
            if (this.currentSession?.status === 'authorized') {
                header.style.display = 'flex';
                
                const usernameElement = document.getElementById('username');
                if (usernameElement && userData?.username) {
                    usernameElement.textContent = userData.username;
                }
            } else {
                header.style.display = 'none';
            }
        }
        
        // Обновляем индикатор статуса
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            if (this.currentSession?.status === 'authorized') {
                statusIndicator.style.backgroundColor = '#28a745';
                statusIndicator.title = 'Авторизован';
            } else if (this.currentSession?.status === 'anonymous') {
                statusIndicator.style.backgroundColor = '#ffc107';
                statusIndicator.title = 'Анонимный';
            } else {
                statusIndicator.style.backgroundColor = '#dc3545';
                statusIndicator.title = 'Не авторизован';
            }
        }
    }
    
    showVerificationForm(email, password = null) {
        // Реализация формы верификации
        // (ваш существующий код остается)
    }
}

// Глобальный экземпляр
const auth = new Auth();
window.auth = auth;