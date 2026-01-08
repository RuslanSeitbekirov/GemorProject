// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Для статических файлов

// Подключение к PostgreSQL
const pool = new Pool({
    host: 'localhost',
    port: 5438,
    database: 'test_system',
    user: 'postgres',
    password: '12345'
});

// Конфигурация JWT
const JWT_SECRET = 'your-secret-key-change-this';
const JWT_REFRESH_SECRET = 'your-refresh-secret-change-this';

// Email транспорт (для демо используем ethereal.email)
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'your-ethereal-email',
        pass: 'your-ethereal-password'
    }
});

// ========== API ENDPOINTS ==========

// 1. Проверка сессии
app.get('/api/session/check', async (req, res) => {
    const sessionToken = req.cookies?.session_token;
    
    if (!sessionToken) {
        return res.json({ status: 'unknown' });
    }
    
    try {
        const result = await pool.query(
            'SELECT * FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()',
            [sessionToken]
        );
        
        if (result.rows.length === 0) {
            return res.json({ status: 'unknown' });
        }
        
        const session = result.rows[0];
        return res.json({
            status: session.status,
            userData: session.data,
            accessToken: session.access_token,
            loginToken: session.login_token
        });
    } catch (error) {
        console.error('Session check error:', error);
        return res.json({ status: 'unknown' });
    }
});

// 2. Создание анонимной сессии
app.post('/api/session/anonymous', async (req, res) => {
    const { type } = req.query;
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const loginToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
    
    try {
        await pool.query(
            `INSERT INTO user_sessions (session_token, status, login_token, expires_at, data) 
             VALUES ($1, 'anonymous', $2, $3, $4)`,
            [sessionToken, loginToken, expiresAt, { provider: type }]
        );
        
        // Устанавливаем куку
        res.cookie('session_token', sessionToken, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
            path: '/'
        });
        
        return res.json({ 
            success: true, 
            loginToken,
            redirectUrl: `/auth/${type}?token=${loginToken}`
        });
    } catch (error) {
        console.error('Anonymous session error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Авторизация через email/пароль
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // Проверяем наличие пользователя
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (userResult.rows.length === 0) {
            // Аккаунт не найден - предлагаем создать
            const verificationCode = Math.floor(100000 + Math.random() * 900000);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
            
            // Сохраняем код верификации
            await pool.query(
                `INSERT INTO users (email, verification_code, verification_expires) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (email) 
                 DO UPDATE SET verification_code = $2, verification_expires = $3`,
                [email, verificationCode, expiresAt]
            );
            
            // Отправляем email (в демо просто возвращаем код)
            return res.json({ 
                status: 'needs_verification',
                verificationCode: verificationCode // В продакшене не отправляем!
            });
        }
        
        const user = userResult.rows[0];
        
        // Проверяем пароль для администратора
        if (email === 'admin@test.com' && password === '1410') {
            // Админский вход без верификации
            return generateAuthResponse(user, res);
        }
        
        // Проверяем пароль для обычных пользователей
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Проверяем верификацию email
        if (!user.email_verified) {
            const verificationCode = Math.floor(100000 + Math.random() * 900000);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            
            await pool.query(
                'UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3',
                [verificationCode, expiresAt, user.id]
            );
            
            return res.json({ 
                status: 'needs_verification',
                verificationCode: verificationCode
            });
        }
        
        return generateAuthResponse(user, res);
        
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. Верификация email
app.post('/api/auth/verify', async (req, res) => {
    const { email, code, password } = req.body;
    
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND verification_code = $2 AND verification_expires > NOW()',
            [email, code]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        
        const user = result.rows[0];
        
        // Если есть пароль - обновляем хэш
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            
            await pool.query(
                'UPDATE users SET password_hash = $1, email_verified = TRUE, verification_code = NULL, verification_expires = NULL WHERE id = $2',
                [hash, user.id]
            );
        } else {
            await pool.query(
                'UPDATE users SET email_verified = TRUE, verification_code = NULL, verification_expires = NULL WHERE id = $1',
                [user.id]
            );
        }
        
        // Создаем или получаем существующую сессию
        const sessionToken = req.cookies?.session_token || crypto.randomBytes(32).toString('hex');
        
        return generateAuthResponse({ ...user, email_verified: true }, res, sessionToken);
        
    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 5. Получение списка тестов пользователя
app.get('/api/tests', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const result = await pool.query(
            'SELECT * FROM tests WHERE user_id = $1 ORDER BY created_at DESC',
            [decoded.userId]
        );
        
        return res.json({ tests: result.rows });
    } catch (error) {
        console.error('Get tests error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// 6. Сохранение теста
app.post('/api/tests', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const { test_name, description, time_limit, test_data } = req.body;
        
        const result = await pool.query(
            `INSERT INTO tests (user_id, test_name, description, time_limit, test_data) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, created_at`,
            [decoded.userId, test_name, description, time_limit, test_data]
        );
        
        return res.json({ 
            success: true, 
            testId: result.rows[0].id,
            createdAt: result.rows[0].created_at
        });
    } catch (error) {
        console.error('Save test error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 7. Обновление теста
app.put('/api/tests/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    const testId = req.params.id;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const { test_name, description, time_limit, test_data } = req.body;
        
        const result = await pool.query(
            `UPDATE tests 
             SET test_name = $1, description = $2, time_limit = $3, test_data = $4, updated_at = NOW() 
             WHERE id = $5 AND user_id = $6 
             RETURNING id`,
            [test_name, description, time_limit, test_data, testId, decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }
        
        return res.json({ success: true });
    } catch (error) {
        console.error('Update test error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 8. Удаление теста
app.delete('/api/tests/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    const testId = req.params.id;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const result = await pool.query(
            'DELETE FROM tests WHERE id = $1 AND user_id = $2 RETURNING id',
            [testId, decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }
        
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete test error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 9. Выход из системы
app.post('/api/auth/logout', async (req, res) => {
    const sessionToken = req.cookies?.session_token;
    const { allDevices } = req.body;
    
    if (sessionToken) {
        await pool.query(
            'DELETE FROM user_sessions WHERE session_token = $1',
            [sessionToken]
        );
        
        res.clearCookie('session_token');
    }
    
    // Если выход со всех устройств - удаляем refresh токен
    if (allDevices) {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
                // Можно добавить логику инвалидации refresh токена
            } catch (error) {
                // Токен уже невалиден
            }
        }
    }
    
    return res.json({ success: true });
});

// Вспомогательная функция для генерации JWT токенов
function generateAuthResponse(user, res, sessionToken = null) {
    const accessToken = jwt.sign(
        { userId: user.id, email: user.email, isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
        { userId: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
    
    // Создаем или обновляем сессию
    const newSessionToken = sessionToken || crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
    
    pool.query(
        `INSERT INTO user_sessions (session_token, user_id, status, access_token, refresh_token, expires_at, data) 
         VALUES ($1, $2, 'authorized', $3, $4, $5, $6) 
         ON CONFLICT (session_token) 
         DO UPDATE SET status = 'authorized', access_token = $3, refresh_token = $4, expires_at = $5, data = $6`,
        [
            newSessionToken,
            user.id,
            accessToken,
            refreshToken,
            expiresAt,
            { 
                id: user.id, 
                email: user.email, 
                username: user.username, 
                isAdmin: user.is_admin 
            }
        ]
    );
    
    // Устанавливаем куку
    res.cookie('session_token', newSessionToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    });
    
    return res.json({
        success: true,
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            isAdmin: user.is_admin
        },
        accessToken,
        refreshToken
    });
}

// Запуск сервера
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});