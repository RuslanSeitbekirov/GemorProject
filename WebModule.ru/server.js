const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Конфигурация PostgreSQL (Docker контейнер)
const poolConfig = {
    host: 'localhost',
    port: 5438,
    database: 'postgres',
    user: 'postgres',
    password: '12345',
    max: 20,
    idleTimeoutMillis: 30000
};

console.log('🔧 Database configuration:', poolConfig);

let db = null;

// Конфигурация почты для отправки кодов подтверждения
const mailTransporter = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true,
    auth: {
        user: 'opatrabotat@mail.ru',
        pass: 'NETrabota6790'
    }
});

// Глобальный кэш для временных кодов подтверждения
const emailVerificationCodes = new Map();

// Функция для проверки подключения к БД
async function testConnection() {
    const pool = new Pool(poolConfig);
    
    try {
        console.log('🔌 Testing PostgreSQL connection...');
        const result = await pool.query('SELECT NOW() as time, version() as version');
        console.log('✅ PostgreSQL connected successfully!');
        console.log('   Time:', result.rows[0].time);
        console.log('   Version:', result.rows[0].version.split('\n')[0]);
        return true;
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error.message);
        return false;
    } finally {
        await pool.end();
    }
}

// Инициализация базы данных
async function initDatabase() {
    try {
        // Проверяем подключение
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Cannot connect to PostgreSQL');
        }
        
        // Создаем базу данных если её нет
        const mainPool = new Pool(poolConfig);
        try {
            console.log('📝 Creating database "test_system" if not exists...');
            await mainPool.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'test_system') THEN
                        CREATE DATABASE test_system;
                        RAISE NOTICE 'Database test_system created';
                    ELSE
                        RAISE NOTICE 'Database test_system already exists';
                    END IF;
                END
                $$;
            `);
            console.log('✅ Database check completed');
        } catch (error) {
            console.error('❌ Error creating database:', error.message);
        } finally {
            await mainPool.end();
        }
        
        // Подключаемся к базе test_system
        const dbPool = new Pool({
            ...poolConfig,
            database: 'test_system'
        });
        
        // Проверяем подключение к новой базе
        try {
            await dbPool.query('SELECT NOW()');
            console.log('✅ Connected to test_system database');
        } catch (error) {
            console.error('❌ Cannot connect to test_system:', error.message);
            console.log('   Trying to create tables in default database instead...');
            // Если не можем подключиться к test_system, используем postgres
            const fallbackPool = new Pool(poolConfig);
            await createTables(fallbackPool);
            return fallbackPool;
        }
        
        // Создаем таблицы
        await createTables(dbPool);
        
        console.log('✅ Database initialization completed!');
        return dbPool;
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        console.log('⚠️ Switching to demo mode...');
        return null;
    }
}

async function createTables(dbPool) {
    // Создаем схему если её нет
    await dbPool.query(`
        CREATE SCHEMA IF NOT EXISTS test_system;
    `);
    
    // Устанавливаем путь поиска
    await dbPool.query(`
        SET search_path TO test_system, public;
    `);
    
    // Таблица пользователей (с email подтверждением)
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(100),
            password_hash VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_admin BOOLEAN DEFAULT FALSE,
            email_verified BOOLEAN DEFAULT FALSE
        )
    `);
    
    // Таблица тестов
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS tests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            test_name VARCHAR(255) NOT NULL,
            description TEXT,
            time_limit INTEGER DEFAULT 600,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            test_data JSONB NOT NULL
        )
    `);
    
    // Таблица сессий
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_token VARCHAR(255) PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(50) DEFAULT 'anonymous',
            access_token TEXT,
            refresh_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            user_data JSONB
        )
    `);
    
    // Таблица логов действий пользователей
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS user_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            username VARCHAR(100),
            email VARCHAR(255),
            action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            website VARCHAR(255),
            action VARCHAR(500) NOT NULL
        )
    `);
    
    // Проверяем и создаем админа
    const adminCheck = await dbPool.query(
        "SELECT COUNT(*) as count FROM users WHERE email = 'admin@test.com'"
    );
    
    if (parseInt(adminCheck.rows[0].count) === 0) {
        console.log('👑 Creating admin user...');
        const hash = await bcrypt.hash('1410', 10);
        await dbPool.query(`
            INSERT INTO users (email, username, password_hash, is_admin, email_verified)
            VALUES ($1, $2, $3, TRUE, TRUE)
        `, ['admin@test.com', 'Admin', hash]);
        console.log('✅ Admin user created: admin@test.com / 1410');
    }
}

// Функция для логирования действий
async function logUserAction(db, userId, username, email, website, action) {
    try {
        if (db) {
            await db.query(`
                INSERT INTO user_logs (user_id, username, email, website, action)
                VALUES ($1, $2, $3, $4, $5)
            `, [userId, username, email, website, action]);
        }
    } catch (error) {
        console.error('Error logging user action:', error);
    }
}

// Функция отправки кода подтверждения на email
async function sendVerificationCode(email, code) {
    try {
        const mailOptions = {
            from: 'opatrabotat@mail.ru',
            to: email,
            subject: 'Код подтверждения для регистрации в системе тестирования',
            text: `Ваш код подтверждения: ${code}\nКод действителен в течение 10 минут.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Код подтверждения</h2>
                    <p>Ваш код для подтверждения регистрации:</p>
                    <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                        ${code}
                    </div>
                    <p>Код действителен в течение 10 минут.</p>
                    <p>Если вы не регистрировались в системе тестирования, просто проигнорируйте это письмо.</p>
                </div>
            `
        };

        await mailTransporter.sendMail(mailOptions);
        console.log(`✅ Verification code sent to ${email}: ${code}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending verification code:', error);
        return false;
    }
}

// ========== API ENDPOINTS ==========

// Health check
app.get('/api/health', async (req, res) => {
    try {
        if (db) {
            await db.query('SELECT 1');
            return res.json({ 
                status: 'healthy',
                database: 'connected',
                timestamp: new Date().toISOString()
            });
        } else {
            return res.json({
                status: 'healthy',
                database: 'memory',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        return res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Отправка кода подтверждения
app.post('/api/auth/send-code', async (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Некорректный email адрес' });
    }
    
    try {
        // Проверяем, есть ли уже пользователь с таким email
        if (db) {
            const result = await db.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );
            
            if (result.rows.length > 0) {
                return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            }
        }
        
        // Генерируем 6-значный код
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Сохраняем код в кэш (10 минут)
        emailVerificationCodes.set(email, {
            code: code,
            expires: Date.now() + 10 * 60 * 1000
        });
        
        // Отправляем код на email
        const sent = await sendVerificationCode(email, code);
        
        if (sent) {
            return res.json({ 
                success: true, 
                message: 'Код подтверждения отправлен на email',
                expiresIn: '10 минут'
            });
        } else {
            return res.status(500).json({ error: 'Ошибка при отправке кода подтверждения' });
        }
        
    } catch (error) {
        console.error('Send code error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Проверка кода подтверждения
app.post('/api/auth/verify-code', async (req, res) => {
    const { email, code, password } = req.body;
    
    if (!email || !code || !password) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    
    try {
        // Проверяем код
        const storedCode = emailVerificationCodes.get(email);
        
        if (!storedCode) {
            return res.status(400).json({ error: 'Код не найден или истек' });
        }
        
        if (storedCode.code !== code) {
            return res.status(400).json({ error: 'Неверный код подтверждения' });
        }
        
        if (Date.now() > storedCode.expires) {
            emailVerificationCodes.delete(email);
            return res.status(400).json({ error: 'Срок действия кода истек' });
        }
        
        // Создаем пользователя
        const username = email.split('@')[0];
        const hash = await bcrypt.hash(password, 10);
        
        const result = await db.query(`
            INSERT INTO users (email, username, password_hash, email_verified)
            VALUES ($1, $2, $3, TRUE)
            RETURNING id, email, username, is_admin
        `, [email, username, hash]);
        
        const user = result.rows[0];
        
        // Удаляем использованный код
        emailVerificationCodes.delete(email);
        
        // Логируем действие
        await logUserAction(db, user.id, user.username, user.email, 'Registration', 'User registered with email verification');
        
        // Создаем токен и сессию
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email },
            'test-system-secret-key',
            { expiresIn: '15m' }
        );
        
        const refreshToken = jwt.sign(
            { userId: user.id },
            'test-system-refresh-secret-key',
            { expiresIn: '7d' }
        );
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        await db.query(`
            INSERT INTO user_sessions (session_token, user_id, status, access_token, refresh_token, expires_at, user_data)
            VALUES ($1, $2, 'authorized', $3, $4, $5, $6)
        `, [
            sessionToken,
            user.id,
            accessToken,
            refreshToken,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            { 
                id: user.id, 
                email: user.email, 
                username: user.username, 
                isAdmin: user.is_admin || false 
            }
        ]);
        
        // Устанавливаем куку
        res.cookie('session_token', sessionToken, {
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
                isAdmin: user.is_admin || false
            },
            accessToken: accessToken,
            refreshToken: refreshToken
        });
        
    } catch (error) {
        console.error('Verify code error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Авторизация
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt:', email);
    
    // Админский вход (без подтверждения email)
    if ((email.toLowerCase() === 'admin' || email === 'admin@test.com') && password === '1410') {
        console.log('🔑 Admin login attempt detected');
        
        // Проверяем, есть ли админ в базе
        if (db) {
            const adminCheck = await db.query(
                "SELECT id, password_hash FROM users WHERE email = 'admin@test.com'"
            );
            
            if (adminCheck.rows.length === 0) {
                console.log('❌ Admin not found in database');
                return res.status(400).json({ 
                    error: 'Администратор не найден. Запустите fix-admin.js' 
                });
            }
            
            const admin = adminCheck.rows[0];
            const validPassword = await bcrypt.compare(password, admin.password_hash);
            
            if (!validPassword) {
                console.log('❌ Invalid admin password');
                return res.status(401).json({ 
                    error: 'Неправильный пароль администратора. Запустите fix-admin.js' 
                });
            }
            
            console.log('✅ Admin credentials verified');
        }
        
        return handleAdminLogin(res);
    }
    try {
        let user;
        
        if (db) {
            // Ищем пользователя в БД
            const result = await db.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );
            
            if (result.rows.length === 0) {
                // Пользователь не найден - показываем форму для подтверждения email
                return res.json({ 
                    status: 'needs_verification',
                    email: email,
                    message: 'Пользователь не найден. Отправить код подтверждения на email?'
                });
            }
            
            user = result.rows[0];
            
            // Проверяем пароль
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(400).json({ error: 'Неверный пароль' });
            }
            
            // Проверяем подтверждение email
            if (!user.email_verified) {
                // Отправляем код подтверждения
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                emailVerificationCodes.set(email, {
                    code: code,
                    expires: Date.now() + 10 * 60 * 1000
                });
                
                await sendVerificationCode(email, code);
                
                return res.json({
                    status: 'needs_verification',
                    email: email,
                    message: 'Email не подтвержден. Код отправлен на вашу почту.'
                });
            }
        } else {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
        // Логируем вход
        await logUserAction(db, user.id, user.username, user.email, 'Login', 'User logged in');
        
        // Создаем токены
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email },
            'test-system-secret-key',
            { expiresIn: '15m' }
        );
        
        const refreshToken = jwt.sign(
            { userId: user.id },
            'test-system-refresh-secret-key',
            { expiresIn: '7d' }
        );
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        // Сохраняем сессию
        await db.query(`
            INSERT INTO user_sessions (session_token, user_id, status, access_token, refresh_token, expires_at, user_data)
            VALUES ($1, $2, 'authorized', $3, $4, $5, $6)
        `, [
            sessionToken,
            user.id,
            accessToken,
            refreshToken,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            { 
                id: user.id, 
                email: user.email, 
                username: user.username, 
                isAdmin: user.is_admin || false 
            }
        ]);
        
        // Устанавливаем куку
        res.cookie('session_token', sessionToken, {
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
                isAdmin: user.is_admin || false
            },
            accessToken: accessToken,
            refreshToken: refreshToken
        });
        
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Админский вход
async function handleAdminLogin(res) {
    console.log('🛡️ Admin login detected');
    
    try {
        if (!db) {
            console.log('❌ Database not available');
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
        // Ищем администратора
        let admin;
        const result = await db.query(
            "SELECT * FROM users WHERE email = 'admin@test.com'"
        );
        
        if (result.rows.length === 0) {
            console.log('❌ Admin not found in database');
            return res.status(400).json({ error: 'Администратор не найден в базе данных' });
        }
        
        admin = result.rows[0];
        console.log(`✅ Admin found: ${admin.email} (ID: ${admin.id})`);
        
        // Проверяем пароль
        const validPassword = await bcrypt.compare('1410', admin.password_hash);
        if (!validPassword) {
            console.log('❌ Invalid admin password');
            return res.status(401).json({ error: 'Неправильный пароль администратора' });
        }
        
        console.log('✅ Admin password is valid');
        
        // Логируем вход админа
        await logUserAction(db, admin.id, admin.username, admin.email, 'Login', 'Admin logged in');
        
        // Создаем токены
        const accessToken = jwt.sign(
            { 
                userId: admin.id, 
                email: admin.email, 
                username: admin.username,
                isAdmin: true 
            },
            'test-system-secret-key',
            { expiresIn: '24h' }
        );
        
        const refreshToken = jwt.sign(
            { userId: admin.id },
            'test-system-refresh-secret-key',
            { expiresIn: '30d' }
        );
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        // Сохраняем сессию
        await db.query(`
            INSERT INTO user_sessions (session_token, user_id, status, access_token, refresh_token, expires_at, user_data)
            VALUES ($1, $2, 'authorized', $3, $4, $5, $6)
            ON CONFLICT (session_token) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                user_data = EXCLUDED.user_data
        `, [
            sessionToken,
            admin.id,
            accessToken,
            refreshToken,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
            { 
                id: admin.id, 
                email: admin.email, 
                username: admin.username, 
                isAdmin: true 
            }
        ]);
        
        // Устанавливаем куки
        res.cookie('session_token', sessionToken, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/'
        });
        
        console.log(`✅ Admin session created: ${sessionToken.substring(0, 20)}...`);
        
        return res.json({
            success: true,
            user: {
                id: admin.id,
                email: admin.email,
                username: admin.username,
                isAdmin: true
            },
            accessToken: accessToken,
            refreshToken: refreshToken,
            message: 'Admin login successful'
        });
        
    } catch (error) {
        console.error('❌ Admin login error:', error);
        return res.status(500).json({ 
            error: 'Внутренняя ошибка сервера',
            details: error.message 
        });
    }
}

// Проверка сессии
app.get('/api/session/check', async (req, res) => {
    const sessionToken = req.cookies?.session_token;
    
    if (!sessionToken) {
        return res.json({ status: 'unknown' });
    }
    
    try {
        if (db) {
            const result = await db.query(
                'SELECT * FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()',
                [sessionToken]
            );
            
            if (result.rows.length === 0) {
                return res.json({ status: 'unknown' });
            }
            
            const session = result.rows[0];
            return res.json({
                status: session.status,
                userData: session.user_data,
                accessToken: session.access_token
            });
        } else {
            return res.json({ status: 'unknown' });
        }
    } catch (error) {
        console.error('Session check error:', error);
        return res.json({ status: 'unknown' });
    }
});

// Получение тестов пользователя
app.get('/api/tests', async (req, res) => {
    try {
        const sessionToken = req.cookies?.session_token;
        
        if (!sessionToken) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        
        let userId;
        
        if (db) {
            const sessionResult = await db.query(
                'SELECT user_id FROM user_sessions WHERE session_token = $1',
                [sessionToken]
            );
            
            if (sessionResult.rows.length === 0) {
                return res.status(401).json({ error: 'Неверная сессия' });
            }
            
            userId = sessionResult.rows[0].user_id;
            
            const result = await db.query(
                'SELECT * FROM tests WHERE user_id = $1 ORDER BY created_at DESC',
                [userId]
            );
            
            // Логируем действие
            await logUserAction(db, userId, null, null, 'My Tests', 'User viewed their tests');
            
            return res.json({ tests: result.rows });
            
        } else {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
    } catch (error) {
        console.error('Get tests error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение всех тестов (публичных)
app.get('/api/tests/all', async (req, res) => {
    try {
        if (db) {
            const result = await db.query(`
                SELECT t.*, u.username as author 
                FROM tests t 
                LEFT JOIN users u ON t.user_id = u.id 
                ORDER BY t.created_at DESC
            `);
            
            return res.json({
                tests: result.rows
            });
        } else {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
    } catch (error) {
        console.error('Get all tests error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение конкретного теста
app.get('/api/tests/:id', async (req, res) => {
    try {
        const testId = req.params.id;
        
        if (db) {
            const result = await db.query(
                'SELECT * FROM tests WHERE id = $1',
                [testId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Тест не найден' });
            }
            
            const test = result.rows[0];
            
            // Логируем просмотр теста
            const sessionToken = req.cookies?.session_token;
            if (sessionToken) {
                const sessionResult = await db.query(
                    'SELECT user_id FROM user_sessions WHERE session_token = $1',
                    [sessionToken]
                );
                if (sessionResult.rows.length > 0) {
                    const userId = sessionResult.rows[0].user_id;
                    await logUserAction(db, userId, null, null, 'View Test', `User viewed test: ${test.test_name}`);
                }
            }
            
            return res.json({ test: test });
        } else {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
    } catch (error) {
        console.error('Get test error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Создание теста
app.post('/api/tests', async (req, res) => {
    try {
        const sessionToken = req.cookies?.session_token;
        if (!sessionToken) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        
        const { test_name, description, time_limit, test_data } = req.body;
        
        if (!test_name || !test_data) {
            return res.status(400).json({ error: 'Название теста и данные обязательны' });
        }
        
        if (db) {
            const sessionResult = await db.query(
                'SELECT user_id FROM user_sessions WHERE session_token = $1',
                [sessionToken]
            );
            
            if (sessionResult.rows.length === 0) {
                return res.status(401).json({ error: 'Неверная сессия' });
            }
            
            const userId = sessionResult.rows[0].user_id;
            
            const result = await db.query(`
                INSERT INTO tests (user_id, test_name, description, time_limit, test_data)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, created_at
            `, [userId, test_name, description, time_limit, test_data]);
            
            const testId = result.rows[0].id;
            
            // Логируем создание теста
            await logUserAction(db, userId, null, null, 'Create Test', `User created test: ${test_name} (ID: ${testId})`);
            
            return res.json({
                success: true,
                testId: testId,
                createdAt: result.rows[0].created_at
            });
            
        } else {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
    } catch (error) {
        console.error('Save test error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Обновление теста
app.put('/api/tests/:id', async (req, res) => {
    try {
        const sessionToken = req.cookies?.session_token;
        if (!sessionToken) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        
        const testId = req.params.id;
        const { test_name, description, time_limit, test_data } = req.body;
        
        if (db) {
            // Проверяем права пользователя на тест
            const sessionResult = await db.query(
                'SELECT user_id FROM user_sessions WHERE session_token = $1',
                [sessionToken]
            );
            
            if (sessionResult.rows.length === 0) {
                return res.status(401).json({ error: 'Неверная сессия' });
            }
            
            const userId = sessionResult.rows[0].user_id;
            
            // Проверяем, принадлежит ли тест пользователю
            const testCheck = await db.query(
                'SELECT user_id FROM tests WHERE id = $1',
                [testId]
            );
            
            if (testCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Тест не найден' });
            }
            
            if (testCheck.rows[0].user_id !== userId) {
                return res.status(403).json({ error: 'Нет прав на редактирование этого теста' });
            }
            
            const result = await db.query(`
                UPDATE tests 
                SET test_name = $1, description = $2, time_limit = $3, test_data = $4
                WHERE id = $5
                RETURNING *
            `, [test_name, description, time_limit, test_data, testId]);
            
            // Логируем обновление теста
            await logUserAction(db, userId, null, null, 'Update Test', `User updated test: ${test_name} (ID: ${testId})`);
            
            return res.json({
                success: true,
                test: result.rows[0]
            });
            
        } else {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
    } catch (error) {
        console.error('Update test error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Удаление теста
app.delete('/api/tests/:id', async (req, res) => {
    try {
        const sessionToken = req.cookies?.session_token;
        if (!sessionToken) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        
        const testId = req.params.id;
        
        if (db) {
            // Проверяем права пользователя на тест
            const sessionResult = await db.query(
                'SELECT user_id FROM user_sessions WHERE session_token = $1',
                [sessionToken]
            );
            
            if (sessionResult.rows.length === 0) {
                return res.status(401).json({ error: 'Неверная сессия' });
            }
            
            const userId = sessionResult.rows[0].user_id;
            
            // Получаем информацию о тесте перед удалением для логирования
            const testInfo = await db.query(
                'SELECT test_name FROM tests WHERE id = $1 AND user_id = $2',
                [testId, userId]
            );
            
            if (testInfo.rows.length === 0) {
                return res.status(404).json({ error: 'Тест не найден или нет прав на удаление' });
            }
            
            const testName = testInfo.rows[0].test_name;
            
            await db.query('DELETE FROM tests WHERE id = $1 AND user_id = $2', [testId, userId]);
            
            // Логируем удаление теста
            await logUserAction(db, userId, null, null, 'Delete Test', `User deleted test: ${testName} (ID: ${testId})`);
            
            return res.json({
                success: true,
                message: 'Тест удален'
            });
            
        } else {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
    } catch (error) {
        console.error('Delete test error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Выход
app.post('/api/auth/logout', async (req, res) => {
    const sessionToken = req.cookies?.session_token;
    const { allDevices } = req.body;
    
    if (sessionToken) {
        try {
            if (db) {
                // Логируем выход
                const sessionResult = await db.query(
                    'SELECT user_id FROM user_sessions WHERE session_token = $1',
                    [sessionToken]
                );
                
                if (sessionResult.rows.length > 0) {
                    const userId = sessionResult.rows[0].user_id;
                    await logUserAction(db, userId, null, null, 'Logout', 'User logged out');
                }
                
                if (allDevices) {
                    // Удаляем все сессии пользователя
                    await db.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
                } else {
                    // Удаляем только текущую сессию
                    await db.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
                }
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        res.clearCookie('session_token');
    }
    
    return res.json({ success: true });
});

// Получение логов пользователя (для админа)
app.get('/api/admin/logs', async (req, res) => {
    try {
        const sessionToken = req.cookies?.session_token;
        
        if (!sessionToken) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        
        if (db) {
            // Проверяем, является ли пользователь админом
            const sessionResult = await db.query(
                'SELECT us.user_id, u.is_admin FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.session_token = $1',
                [sessionToken]
            );
            
            if (sessionResult.rows.length === 0 || !sessionResult.rows[0].is_admin) {
                return res.status(403).json({ error: 'Доступ запрещен' });
            }
            
            const result = await db.query(
                'SELECT * FROM user_logs ORDER BY action_time DESC LIMIT 100'
            );
            
            return res.json({ logs: result.rows });
        } else {
            return res.status(500).json({ error: 'База данных недоступна' });
        }
        
    } catch (error) {
        console.error('Get logs error:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Обновление токенов
app.post('/api/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token обязателен' });
    }
    
    try {
        // Проверяем refresh token
        const decoded = jwt.verify(refreshToken, 'test-system-refresh-secret-key');
        
        // Ищем пользователя
        const userResult = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }
        
        const user = userResult.rows[0];
        
        // Создаем новые токены
        const newAccessToken = jwt.sign(
            { userId: user.id, email: user.email },
            'test-system-secret-key',
            { expiresIn: '15m' }
        );
        
        const newRefreshToken = jwt.sign(
            { userId: user.id },
            'test-system-refresh-secret-key',
            { expiresIn: '7d' }
        );
        
        // Обновляем refresh token в сессии
        await db.query(
            'UPDATE user_sessions SET refresh_token = $1 WHERE user_id = $2 AND refresh_token = $3',
            [newRefreshToken, user.id, refreshToken]
        );
        
        return res.json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
        
    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(401).json({ error: 'Неверный или истекший refresh token' });
    }
});

// Главная страница
app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api/')) {
        next();
    } else {
        // Для всех не-API запросов отдаем index.html
        res.sendFile(__dirname + '/public/index.html');
    }
});

// Запуск сервера
async function startServer() {
    console.log('🚀 Starting Test System Server...');
    console.log('📡 Port:', port);
    console.log('🗄️ PostgreSQL: localhost:5438');
    
    try {
        // Инициализация базы данных
        db = await initDatabase();
        
        if (!db) {
            console.log('⚠️ Database connection failed, starting in limited mode');
            console.log('💡 Note: To use PostgreSQL, ensure container is running');
            console.log('   Command: docker ps');
            console.log('   If not running: docker start TestDataBase');
        }
        
        app.listen(port, () => {
            console.log(`✅ Server running at http://localhost:${port}`);
            console.log('');
            console.log('📊 Available endpoints:');
            console.log('   • http://localhost:3000/                     - Main page');
            console.log('   • http://localhost:3000/api/health           - Health check');
            console.log('   • http://localhost:3000/api/auth/login       - Login');
            console.log('   • http://localhost:3000/api/auth/send-code   - Send verification code');
            console.log('   • http://localhost:3000/api/tests            - User tests');
            console.log('');
            console.log('👤 Demo accounts:');
            console.log('   • Admin:        admin / 1410');
            console.log('   • Any user:     any@email.com (will send verification code)');
            console.log('');
            console.log('📧 Email for verification: opatrabotat@mail.ru');
            console.log('');
            console.log('🐛 Debug tools:');
            console.log('   • Check containers: docker ps');
            console.log('   • Check PostgreSQL: docker exec TestDataBase psql -U postgres -c "\\l"');
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();