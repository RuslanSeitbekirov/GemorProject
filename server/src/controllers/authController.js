const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const redisClient = require('../config/redis');
const { sendVerificationEmail } = require('../services/emailService');

class AuthController {
    // Проверка OAuth токена
    async checkOAuthToken(req, res) {
        try {
            const { loginToken } = req.body;
            
            // Проверяем токен в Redis
            const tokenData = await redisClient.get(`login_token:${loginToken}`);
            
            if (!tokenData) {
                return res.json({ status: 'token_not_found' });
            }
            
            const parsedData = JSON.parse(tokenData);
            
            // Проверяем время жизни токена
            if (Date.now() > parsedData.expiresAt) {
                await redisClient.del(`login_token:${loginToken}`);
                return res.json({ status: 'token_expired' });
            }
            
            if (parsedData.status === 'granted') {
                // Генерируем JWT токены
                const accessToken = jwt.sign(
                    { userId: parsedData.userId, email: parsedData.email },
                    process.env.JWT_SECRET,
                    { expiresIn: '15m' }
                );
                
                const refreshToken = jwt.sign(
                    { userId: parsedData.userId },
                    process.env.JWT_REFRESH_SECRET,
                    { expiresIn: '7d' }
                );
                
                // Сохраняем refresh токен в базе
                await pool.query(
                    'INSERT INTO user_sessions (user_id, refresh_token) VALUES ($1, $2)',
                    [parsedData.userId, refreshToken]
                );
                
                return res.json({
                    status: 'access_granted',
                    accessToken,
                    refreshToken,
                    user: {
                        id: parsedData.userId,
                        email: parsedData.email,
                        username: parsedData.username
                    }
                });
            } else if (parsedData.status === 'denied') {
                return res.json({ status: 'access_denied' });
            } else {
                return res.json({ status: 'pending' });
            }
        } catch (error) {
            console.error('Check OAuth token error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // Регистрация/логин через email
    async emailLogin(req, res) {
        try {
            const { email, password } = req.body;
            
            // Проверяем существующего пользователя
            const result = await pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );
            
            if (result.rows.length === 0) {
                // Новый пользователь - отправляем код верификации
                const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                
                // Сохраняем код в базе
                await pool.query(
                    `INSERT INTO users (email, verification_code, verification_expires) 
                     VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
                     ON CONFLICT (email) 
                     DO UPDATE SET verification_code = $2, verification_expires = NOW() + INTERVAL '10 minutes'`,
                    [email, verificationCode]
                );
                
                // Отправляем email
                await sendVerificationEmail(email, verificationCode);
                
                return res.json({
                    status: 'needs_verification',
                    message: 'Verification code sent'
                });
            }
            
            const user = result.rows[0];
            
            // Проверяем пароль
            const validPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Генерируем токены
            const accessToken = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
            
            const refreshToken = jwt.sign(
                { userId: user.id },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );
            
            // Сохраняем сессию
            await pool.query(
                'INSERT INTO user_sessions (user_id, refresh_token) VALUES ($1, $2)',
                [user.id, refreshToken]
            );
            
            res.json({
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    isAdmin: user.is_admin
                }
            });
            
        } catch (error) {
            console.error('Email login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // Подтверждение email кода
    async verifyEmailCode(req, res) {
        try {
            const { email, code, password } = req.body;
            
            const result = await pool.query(
                `SELECT * FROM users 
                 WHERE email = $1 
                 AND verification_code = $2 
                 AND verification_expires > NOW()`,
                [email, code]
            );
            
            if (result.rows.length === 0) {
                return res.status(400).json({ error: 'Invalid or expired code' });
            }
            
            // Хешируем пароль
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            
            // Обновляем пользователя
            await pool.query(
                `UPDATE users 
                 SET password_hash = $1, 
                     is_verified = true,
                     verification_code = NULL,
                     verification_expires = NULL,
                     updated_at = NOW()
                 WHERE email = $2`,
                [passwordHash, email]
            );
            
            // Генерируем токены
            const accessToken = jwt.sign(
                { userId: result.rows[0].id, email },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
            
            const refreshToken = jwt.sign(
                { userId: result.rows[0].id },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );
            
            // Сохраняем сессию
            await pool.query(
                'INSERT INTO user_sessions (user_id, refresh_token) VALUES ($1, $2)',
                [result.rows[0].id, refreshToken]
            );
            
            res.json({
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: result.rows[0].id,
                    email: email,
                    username: result.rows[0].username,
                    isVerified: true
                }
            });
            
        } catch (error) {
            console.error('Verify email error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // Выход
    async logout(req, res) {
        try {
            const { refreshToken } = req.body;
            
            if (refreshToken) {
                await pool.query(
                    'DELETE FROM user_sessions WHERE refresh_token = $1',
                    [refreshToken]
                );
            }
            
            res.json({ success: true });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // Обновление токена
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            
            // Проверяем refresh токен в базе
            const result = await pool.query(
                'SELECT user_id FROM user_sessions WHERE refresh_token = $1',
                [refreshToken]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid refresh token' });
            }
            
            const userId = result.rows[0].user_id;
            
            // Получаем информацию о пользователе
            const userResult = await pool.query(
                'SELECT * FROM users WHERE id = $1',
                [userId]
            );
            
            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const user = userResult.rows[0];
            
            // Генерируем новую пару токенов
            const newAccessToken = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
            
            const newRefreshToken = jwt.sign(
                { userId: user.id },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );
            
            // Обновляем refresh токен в базе
            await pool.query(
                'UPDATE user_sessions SET refresh_token = $1 WHERE refresh_token = $2',
                [newRefreshToken, refreshToken]
            );
            
            res.json({
                success: true,
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            });
            
        } catch (error) {
            console.error('Refresh token error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new AuthController();