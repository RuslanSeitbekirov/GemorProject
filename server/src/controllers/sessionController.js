const crypto = require('crypto');
const { pool } = require('../config/database');
const redisClient = require('../config/redis');

class SessionController {
    // Проверка сессии
    async checkSession(req, res) {
        try {
            const sessionToken = req.cookies.session_token;
            
            if (!sessionToken) {
                return res.json({ status: 'unknown' });
            }
            
            // Проверяем сессию в Redis
            const sessionData = await redisClient.get(`session:${sessionToken}`);
            
            if (!sessionData) {
                return res.json({ status: 'unknown' });
            }
            
            const parsedData = JSON.parse(sessionData);
            
            // Проверяем не истекла ли сессия
            if (Date.now() > parsedData.expiresAt) {
                await redisClient.del(`session:${sessionToken}`);
                return res.json({ status: 'unknown' });
            }
            
            // Обновляем время жизни сессии
            parsedData.expiresAt = Date.now() + 10 * 60 * 1000; // 10 минут
            await redisClient.setEx(
                `session:${sessionToken}`,
                600,
                JSON.stringify(parsedData)
            );
            
            res.json(parsedData);
            
        } catch (error) {
            console.error('Check session error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // Создание анонимной сессии
    async createAnonymousSession(req, res) {
        try {
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const loginToken = crypto.randomBytes(32).toString('hex');
            
            const sessionData = {
                status: 'anonymous',
                loginToken: loginToken,
                createdAt: Date.now(),
                expiresAt: Date.now() + 10 * 60 * 1000 // 10 минут
            };
            
            // Сохраняем сессию в Redis
            await redisClient.setEx(
                `session:${sessionToken}`,
                600,
                JSON.stringify(sessionData)
            );
            
            // Сохраняем токен входа
            await redisClient.setEx(
                `login_token:${loginToken}`,
                600,
                JSON.stringify({
                    sessionToken: sessionToken,
                    status: 'pending',
                    createdAt: Date.now()
                })
            );
            
            // Устанавливаем куки
            res.cookie('session_token', sessionToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 10 * 60 * 1000, // 10 минут
                sameSite: 'lax'
            });
            
            res.json({
                sessionToken,
                loginToken,
                status: 'anonymous'
            });
            
        } catch (error) {
            console.error('Create session error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // Обновление сессии до авторизованной
    async upgradeToAuthorized(req, res) {
        try {
            const { sessionToken, accessToken, refreshToken, userData } = req.body;
            
            // Получаем текущую сессию
            const sessionData = await redisClient.get(`session:${sessionToken}`);
            
            if (!sessionData) {
                return res.status(404).json({ error: 'Session not found' });
            }
            
            const parsedData = JSON.parse(sessionData);
            
            // Обновляем данные сессии
            parsedData.status = 'authorized';
            parsedData.accessToken = accessToken;
            parsedData.refreshToken = refreshToken;
            parsedData.userData = userData;
            parsedData.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 часа
            
            // Удаляем токен входа если есть
            if (parsedData.loginToken) {
                await redisClient.del(`login_token:${parsedData.loginToken}`);
                delete parsedData.loginToken;
            }
            
            // Сохраняем обновленную сессию
            await redisClient.setEx(
                `session:${sessionToken}`,
                86400, // 24 часа в секундах
                JSON.stringify(parsedData)
            );
            
            res.json({
                success: true,
                session: parsedData
            });
            
        } catch (error) {
            console.error('Upgrade session error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // Удаление сессии
    async deleteSession(req, res) {
        try {
            const { sessionToken } = req.body;
            
            if (!sessionToken) {
                return res.status(400).json({ error: 'Session token required' });
            }
            
            // Получаем данные сессии для удаления токена входа
            const sessionData = await redisClient.get(`session:${sessionToken}`);
            
            if (sessionData) {
                const parsedData = JSON.parse(sessionData);
                if (parsedData.loginToken) {
                    await redisClient.del(`login_token:${parsedData.loginToken}`);
                }
            }
            
            // Удаляем сессию
            await redisClient.del(`session:${sessionToken}`);
            
            // Очищаем куки
            res.clearCookie('session_token');
            
            res.json({ success: true });
            
        } catch (error) {
            console.error('Delete session error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new SessionController();