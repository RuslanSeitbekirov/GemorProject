// public/js/auth.js
class Auth {
    constructor() {
        this.API_BASE = '/api';
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
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.currentSession = data;
            
            this.handleSessionStatus(data.status, data);
            return data;
        } catch (error) {
            console.error('Session check error:', error);
            this.handleSessionStatus('unknown');
            return { status: 'unknown' };
        }
    }
    
    handleSessionStatus(status, data = null) {
        switch(status) {
            case 'unknown':
                this.handleUnknownUser();
                break;
            case 'anonymous':
                this.handleAnonymousUser(data);
                break;
            case 'authorized':
                this.handleAuthorizedUser(data);
                break;
        }
    }
    
    handleUnknownUser() {
        const path = window.location.pathname;
        const allowedPaths = ['/Registration.html', '/login.html', '/'];
        
        if (!allowedPaths.some(p => path.includes(p))) {
            window.location.href = '/Registration.html';
        }
        
        // Создаем анонимную сессию
        this.createAnonymousSession();
    }
    
    async createAnonymousSession() {
        try {
            const response = await fetch(`${this.API_BASE}/session/create`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentSession = data;
                this.updateUI();
            }
        } catch (error) {
            console.error('Create anonymous session error:', error);
        }
    }
    
    handleAnonymousUser(sessionData) {
        console.log('Anonymous session:', sessionData);
        this.updateUI();
    }
    
    handleAuthorizedUser(sessionData) {
        // Сохраняем данные пользователя в localStorage
        if (sessionData.userData) {
            localStorage.setItem('userData', JSON.stringify(sessionData.userData));
            localStorage.setItem('userId', sessionData.userData.id);
        }
        
        this.updateUI();
        
        // Перенаправляем с страниц авторизации
        if (window.location.pathname.includes('Registration.html') || 
            window.location.pathname.includes('login.html')) {
            window.location.href = '/';
        }
    }
    
    async login(email, password) {
        try {
            // Специальная обработка для администратора
            if (email.toLowerCase() === 'admin' && password === '1410') {
                email = 'admin@test.com';
            }
            
            const response = await fetch(`${this.API_BASE}/auth/login`, {
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
                // Обновляем сессию
                await this.upgradeSession(data.accessToken, data.refreshToken, data.user);
                
                this.updateUI();
                window.location.href = '/';
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
                    accessToken,
                    refreshToken,
                    userData
                }),
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentSession = data.session;
                this.updateUI();
            }
        } catch (error) {
            console.error('Upgrade session error:', error);
        }
    }
    
    updateUI() {
        const userData = this.currentSession?.userData || 
                        JSON.parse(localStorage.getItem('userData') || '{}');
        
        // Обновляем шапку
        const header = document.getElementById('header');
        if (header) {
            if (this.currentSession?.status === 'authorized') {
                header.style.display = 'flex';
                
                const usernameElement = document.getElementById('username');
                if (usernameElement && userData.username) {
                    usernameElement.textContent = userData.username;
                }
                
                const profileImg = document.getElementById('Profile_img');
                if (profileImg && userData.avatar) {
                    profileImg.src = userData.avatar;
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
            
            // Очищаем локальное хранилище
            localStorage.clear();
            sessionStorage.clear();
            
            // Перенаправляем на страницу авторизации
            window.location.href = '/Registration.html';
            
        } catch (error) {
            console.error('Logout error:', error);
            localStorage.clear();
            window.location.href = '/Registration.html';
        }
    }
}

// Глобальный экземпляр
const auth = new Auth();
window.auth = auth;

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
}