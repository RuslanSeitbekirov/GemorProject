// sessionStore.js
class SessionStore {
    constructor() {
        // Используем localStorage как временное хранилище
        // В реальной системе это будет Redis
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const stored = localStorage.getItem('_session_store');
        if (stored) {
            const data = JSON.parse(stored);
            this.sessions = new Map(data.sessions);
            this.loginTokens = new Map(data.loginTokens);
        } else {
            this.sessions = new Map();
            this.loginTokens = new Map();
        }
    }
    
    saveToStorage() {
        const data = {
            sessions: Array.from(this.sessions.entries()),
            loginTokens: Array.from(this.loginTokens.entries())
        };
        localStorage.setItem('_session_store', JSON.stringify(data));
    }
    
    createAnonymousSession(sessionToken, loginToken) {
        this.sessions.set(sessionToken, {
            status: 'anonymous',
            loginToken: loginToken,
            createdAt: Date.now(),
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 минут
        });
        
        this.loginTokens.set(loginToken, {
            sessionToken: sessionToken,
            status: 'pending',
            createdAt: Date.now()
        });
        
        this.saveToStorage();
    }
    
    getSession(sessionToken) {
        return this.sessions.get(sessionToken);
    }
    
    upgradeToAuthorized(sessionToken, accessToken, refreshToken, userData) {
        const session = this.sessions.get(sessionToken);
        if (session) {
            session.status = 'authorized';
            session.accessToken = accessToken;
            session.refreshToken = refreshToken;
            session.userData = userData;
            session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 часа
            
            // Удаляем токен входа
            if (session.loginToken) {
                this.loginTokens.delete(session.loginToken);
                delete session.loginToken;
            }
            
            this.saveToStorage();
        }
    }
    
    deleteSession(sessionToken) {
        const session = this.sessions.get(sessionToken);
        if (session && session.loginToken) {
            this.loginTokens.delete(session.loginToken);
        }
        this.sessions.delete(sessionToken);
        this.saveToStorage();
    }
    
    getLoginToken(loginToken) {
        return this.loginTokens.get(loginToken);
    }
    
    updateLoginToken(loginToken, data) {
        this.loginTokens.set(loginToken, {
            ...this.loginTokens.get(loginToken),
            ...data
        });
        this.saveToStorage();
    }
}

// Глобальный экземпляр
const sessionStore = new SessionStore();