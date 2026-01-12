// auth.js - обновленная версия с поддержкой подтверждения email
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
            console.log('Login attempt:', email);
            
            // Обработка администратора (логин "admin" без @)
            if (email.toLowerCase() === 'admin' && password === '1410') {
                console.log('Admin login detected, using admin@test.com');
                // Используем admin@test.com для входа
                email = 'admin@test.com';
            }
            
            const response = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            console.log('Login response:', data);
            
            if (data.status === 'needs_verification') {
                // Показываем форму верификации
                this.showVerificationForm(email, password);
                return data;
            }
            
            if (data.success) {
                // Сохраняем данные
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                
                console.log('Login successful, redirecting to index.html');
                window.location.href = 'index.html';
            } else if (data.error) {
                alert('Ошибка входа: ' + data.error);
            }
            
            return data;
        } catch (error) {
            console.error('Login error:', error);
            return { error: 'Ошибка сети' };
        }
    }
    
    async sendVerificationCode(email) {
        try {
            const response = await fetch(`${this.API_BASE}/auth/send-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Код подтверждения отправлен на вашу почту. Проверьте папку "Входящие" и "Спам".');
                return true;
            } else {
                alert('Ошибка: ' + data.error);
                return false;
            }
        } catch (error) {
            console.error('Send code error:', error);
            alert('Ошибка при отправке кода подтверждения');
            return false;
        }
    }
    
    async verifyEmailCode(email, code, password) {
        try {
            const response = await fetch(`${this.API_BASE}/auth/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                
                alert('Регистрация успешно завершена!');
                window.location.href = 'index.html';
            } else {
                alert('Ошибка: ' + data.error);
            }
            
            return data;
        } catch (error) {
            console.error('Verify code error:', error);
            alert('Ошибка при проверке кода');
            return { error: 'Ошибка сети' };
        }
    }
    
    showVerificationForm(email, password = null) {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;
        
        const isNewUser = password === null;
        
        mainContent.innerHTML = `
            <div class="verification-form" style="max-width: 400px; margin: 50px auto; padding: 30px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="text-align: center; color: #333; margin-bottom: 20px;">Подтверждение email</h2>
                <p style="text-align: center; color: #666; margin-bottom: 20px;">
                    ${isNewUser ? 
                        'Для регистрации нового пользователя' : 
                        'Для подтверждения вашего email'}
                    <br>
                    <strong>${email}</strong>
                </p>
                
                ${isNewUser ? `
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Пароль:</label>
                        <input type="password" id="newPassword" placeholder="Придумайте пароль" 
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; margin-bottom: 15px;">
                    </div>
                ` : ''}
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Код подтверждения:</label>
                    <input type="text" id="verificationCode" maxlength="6" placeholder="Введите 6-значный код" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; text-align: center; letter-spacing: 3px;">
                </div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button onclick="auth.submitVerification('${email}', ${password ? `document.getElementById('newPassword').value` : `'${password}'`})" 
                            style="flex: 1; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        Подтвердить
                    </button>
                    <button onclick="auth.sendVerificationCode('${email}')" 
                            style="flex: 1; padding: 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        Отправить код
                    </button>
                </div>
                
                <div style="text-align: center;">
                    <button onclick="window.location.href='Registration.html'" 
                            style="padding: 10px 20px; background: #f5f5f5; color: #666; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Вернуться к авторизации
                    </button>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
                    <p><strong>Важно:</strong></p>
                    <p>• Код будет отправлен с адреса: opatrabotat@mail.ru</p>
                    <p>• Проверьте папку "Спам", если не видите письмо</p>
                    <p>• Код действителен 10 минут</p>
                </div>
            </div>
        `;
    }
    
    async submitVerification(email, password) {
        const code = document.getElementById('verificationCode').value;
        if (!code || code.length !== 6) {
            alert('Введите 6-значный код подтверждения');
            return;
        }
        
        if (password && password.length < 6) {
            alert('Пароль должен содержать минимум 6 символов');
            return;
        }
        
        await this.verifyEmailCode(email, code, password);
    }
    
    async logout(allDevices = false) {
        try {
            await fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
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
        
        // Обновляем шапку на всех страницах
        const header = document.getElementById('header');
        if (header && userData.username) {
            header.style.display = 'flex';
        }
    }
    
    showMainInterface() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            
            mainContent.innerHTML = `
                <div class="dashboard" style="max-width: 1200px; margin: 20px auto; padding: 20px;">
                    <h1 style="color: #333; margin-bottom: 30px;">Личный кабинет</h1>
                    
                    <div class="user-info" style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="width: 80px; height: 80px; background: #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20px; font-size: 32px; color: white; font-weight: bold;">
                                ${userData.username ? userData.username.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                                <h2 style="margin: 0 0 10px 0; color: #333;">Добро пожаловать, <span id="displayUsername">${userData.username || 'Пользователь'}</span>!</h2>
                                <p style="margin: 0; color: #666;">${userData.email || ''}</p>
                                <p style="margin: 10px 0 0 0;">
                                    Статус: <span class="status-badge" style="background: #28a745; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px;">Авторизован</span>
                                    ${userData.isAdmin ? '<span style="background: #dc3545; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; margin-left: 10px;">Администратор</span>' : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="dashboard-actions" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                        <div class="action-card" onclick="window.location.href='create-test.html'" style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; text-align: center;" 
                             onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 5px 20px rgba(0,0,0,0.15)'" 
                             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.1)'">
                            <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                            <h3 style="margin: 0 0 10px 0; color: #333;">Создать новый тест</h3>
                            <p style="color: #666; margin: 0;">Создайте свой уникальный тест с вопросами и ответами</p>
                        </div>
                        
                        <div class="action-card" onclick="window.location.href='my-tests.html'" style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; text-align: center;" 
                             onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 5px 20px rgba(0,0,0,0.15)'" 
                             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.1)'">
                            <div style="font-size: 48px; margin-bottom: 20px;">📚</div>
                            <h3 style="margin: 0 0 10px 0; color: #333;">Мои тесты</h3>
                            <p style="color: #666; margin: 0;">Просмотр, редактирование и удаление ваших тестов</p>
                        </div>
                        
                        <div class="action-card" onclick="window.location.href='take-test.html'" style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; text-align: center;" 
                             onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 5px 20px rgba(0,0,0,0.15)'" 
                             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.1)'">
                            <div style="font-size: 48px; margin-bottom: 20px;">🎯</div>
                            <h3 style="margin: 0 0 10px 0; color: #333;">Пройти тест</h3>
                            <p style="color: #666; margin: 0;">Пройти существующие тесты или загрузить свой</p>
                        </div>
                    </div>
                    
                    ${userData.isAdmin ? `
                        <div style="margin-top: 30px; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <h3 style="color: #333; margin-bottom: 15px;">Административная панель</h3>
                            <button onclick="window.location.href='test-system.html'" 
                                    style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                                Debug Panel
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        const header = document.getElementById('header');
        if (header) {
            header.style.display = 'flex';
        }
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