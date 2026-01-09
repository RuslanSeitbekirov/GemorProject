const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Конфигурация PostgreSQL
const poolConfig = {
    host: 'localhost',
    port: 5438,
    database: 'postgres',  // Используем стандартную базу
    user: 'postgres',
    password: '12345',
    max: 10,
    idleTimeoutMillis: 30000
};

console.log('🔧 Database configuration:', poolConfig);

let db = null;

// Функция для проверки подключения
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
    
    // Таблица пользователей
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS test_system.users (
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
            user_id INTEGER,
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
            user_id INTEGER,
            status VARCHAR(50) DEFAULT 'anonymous',
            access_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            user_data JSONB
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

// In-memory хранилище для демо
const memoryStore = {
    users: new Map(),
    tests: new Map(),
    sessions: new Map()
};

// Инициализация демо данных
function initMemoryStore() {
    memoryStore.users.set('admin@test.com', {
        id: 1,
        email: 'admin@test.com',
        username: 'Admin',
        passwordHash: bcrypt.hashSync('1410', 10),
        isAdmin: true,
        emailVerified: true
    });
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

// Получить всех пользователей (админ)
app.get('/api/admin/users', async (req, res) => {
    try {
        if (!db) {
            // В демо режиме возвращаем список из памяти
            const users = Array.from(memoryStore.users.values());
            return res.json({ users });
        }
        
        const result = await db.query(
            'SELECT id, email, username, is_admin, created_at FROM users ORDER BY created_at DESC'
        );
        
        return res.json({
            users: result.rows
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Все тесты (публичные)
app.get('/api/tests/all', async (req, res) => {
    try {
        if (!db) {
            // Демо тесты
            return res.json({
                tests: [
                    {
                        id: 1,
                        test_name: 'Public Demo Test',
                        description: 'Sample public test',
                        time_limit: 300,
                        created_at: new Date().toISOString(),
                        author: 'System'
                    }
                ]
            });
        }
        
        const result = await db.query(`
            SELECT t.*, u.username as author 
            FROM tests t 
            LEFT JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC 
            LIMIT 10
        `);
        
        return res.json({
            tests: result.rows
        });
        
    } catch (error) {
        console.error('Get all tests error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Сброс системы (демо)
app.post('/api/admin/reset', async (req, res) => {
    try {
        if (!db) {
            // В демо режиме очищаем память
            memoryStore.tests.clear();
            memoryStore.sessions.clear();
            
            return res.json({
                success: true,
                message: 'Demo system reset completed',
                timestamp: new Date().toISOString()
            });
        }
        
        // В реальной системе
        await db.query('DELETE FROM tests');
        await db.query('DELETE FROM user_sessions');
        await db.query("DELETE FROM users WHERE email != 'admin@test.com'");
        
        return res.json({
            success: true,
            message: 'System reset completed',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Reset error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

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
            
            return res.json({
                status: 'authorized',
                userData: result.rows[0].user_data
            });
        } else {
            const session = memoryStore.sessions.get(sessionToken);
            if (!session) {
                return res.json({ status: 'unknown' });
            }
            
            return res.json({
                status: 'authorized',
                userData: session.userData
            });
        }
    } catch (error) {
        console.error('Session check error:', error);
        return res.json({ status: 'unknown' });
    }
});

// Авторизация
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt:', email);
    
    // Админский вход
    if (email.toLowerCase() === 'admin' && password === '1410') {
        return handleAdminLogin(res);
    }
    
    // Обычный пользователь
    try {
        let user;
        
        if (db) {
            // Ищем пользователя в БД
            const result = await db.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );
            
            if (result.rows.length === 0) {
                // Создаем нового пользователя
                const username = email.split('@')[0];
                const result = await db.query(`
                    INSERT INTO users (email, username, email_verified)
                    VALUES ($1, $2, TRUE)
                    RETURNING id, email, username, is_admin
                `, [email, username]);
                
                user = result.rows[0];
            } else {
                user = result.rows[0];
                if (!user.email_verified) {
                    await db.query(
                        'UPDATE users SET email_verified = TRUE WHERE id = $1',
                        [user.id]
                    );
                }
            }
        } else {
            // In-memory пользователь
            if (!memoryStore.users.has(email)) {
                const userId = Date.now();
                memoryStore.users.set(email, {
                    id: userId,
                    email: email,
                    username: email.split('@')[0],
                    isAdmin: false,
                    emailVerified: true
                });
            }
            user = memoryStore.users.get(email);
        }
        
        // Создаем токен и сессию
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            'demo-secret-key',
            { expiresIn: '24h' }
        );
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        // Сохраняем сессию
        if (db) {
            await db.query(`
                INSERT INTO user_sessions (session_token, user_id, status, access_token, expires_at, user_data)
                VALUES ($1, $2, 'authorized', $3, $4, $5)
            `, [
                sessionToken,
                user.id,
                token,
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                { 
                    id: user.id, 
                    email: user.email, 
                    username: user.username, 
                    isAdmin: user.is_admin || false 
                }
            ]);
        } else {
            memoryStore.sessions.set(sessionToken, {
                userId: user.id,
                accessToken: token,
                userData: { 
                    id: user.id, 
                    email: user.email, 
                    username: user.username, 
                    isAdmin: user.isAdmin || false 
                }
            });
        }
        
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
                isAdmin: user.is_admin || user.isAdmin || false
            },
            accessToken: token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Админский вход
async function handleAdminLogin(res) {
    console.log('🛡️ Admin login detected');
    
    try {
        let admin;
        
        if (db) {
            const result = await db.query(
                "SELECT * FROM users WHERE email = 'admin@test.com'"
            );
            
            if (result.rows.length === 0) {
                const hash = await bcrypt.hash('1410', 10);
                const result = await db.query(`
                    INSERT INTO users (email, username, password_hash, is_admin, email_verified)
                    VALUES ($1, $2, $3, TRUE, TRUE)
                    RETURNING *
                `, ['admin@test.com', 'Admin', hash]);
                admin = result.rows[0];
            } else {
                admin = result.rows[0];
            }
        } else {
            admin = memoryStore.users.get('admin@test.com');
        }
        
        const token = jwt.sign(
            { userId: admin.id, email: admin.email, isAdmin: true },
            'demo-secret-key',
            { expiresIn: '24h' }
        );
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        if (db) {
            await db.query(`
                INSERT INTO user_sessions (session_token, user_id, status, access_token, expires_at, user_data)
                VALUES ($1, $2, 'authorized', $3, $4, $5)
            `, [
                sessionToken,
                admin.id,
                token,
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                { 
                    id: admin.id, 
                    email: admin.email, 
                    username: admin.username, 
                    isAdmin: true 
                }
            ]);
        } else {
            memoryStore.sessions.set(sessionToken, {
                userId: admin.id,
                accessToken: token,
                userData: { 
                    id: admin.id, 
                    email: admin.email, 
                    username: admin.username, 
                    isAdmin: true 
                }
            });
        }
        
        res.cookie('session_token', sessionToken, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });
        
        return res.json({
            success: true,
            user: {
                id: admin.id,
                email: admin.email,
                username: admin.username,
                isAdmin: true
            },
            accessToken: token
        });
        
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Получение тестов пользователя
app.get('/api/tests', async (req, res) => {
    try {
        const sessionToken = req.cookies?.session_token;
        
        if (!sessionToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        let userId;
        
        if (db) {
            const sessionResult = await db.query(
                'SELECT user_id FROM user_sessions WHERE session_token = $1',
                [sessionToken]
            );
            
            if (sessionResult.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid session' });
            }
            
            userId = sessionResult.rows[0].user_id;
            
            const result = await db.query(
                'SELECT * FROM tests WHERE user_id = $1 ORDER BY created_at DESC',
                [userId]
            );
            
            return res.json({ tests: result.rows });
            
        } else {
            // Демо режим
            return res.json({
                tests: [
                    {
                        id: 1,
                        test_name: 'Demo Test 1',
                        description: 'Sample test for demonstration',
                        time_limit: 600,
                        created_at: new Date().toISOString(),
                        test_data: {
                            questions: [
                                {
                                    question: 'Sample question?',
                                    answers: ['Answer 1', 'Answer 2', 'Answer 3'],
                                    correctAnswer: 'Answer 1',
                                    type: 'radio'
                                }
                            ]
                        }
                    }
                ]
            });
        }
        
    } catch (error) {
        console.error('Get tests error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Создание теста
app.post('/api/tests', async (req, res) => {
    try {
        const sessionToken = req.cookies?.session_token;
        if (!sessionToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { test_name, description, time_limit, test_data } = req.body;
        
        if (db) {
            const sessionResult = await db.query(
                'SELECT user_id FROM user_sessions WHERE session_token = $1',
                [sessionToken]
            );
            
            if (sessionResult.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid session' });
            }
            
            const userId = sessionResult.rows[0].user_id;
            
            const result = await db.query(`
                INSERT INTO tests (user_id, test_name, description, time_limit, test_data)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, created_at
            `, [userId, test_name, description, time_limit, test_data]);
            
            return res.json({
                success: true,
                testId: result.rows[0].id,
                createdAt: result.rows[0].created_at
            });
            
        } else {
            // Демо режим
            const testId = Date.now();
            memoryStore.tests.set(testId, {
                id: testId,
                test_name,
                description,
                time_limit,
                test_data,
                created_at: new Date().toISOString()
            });
            
            return res.json({
                success: true,
                testId: testId,
                createdAt: new Date().toISOString(),
                message: 'Demo mode: test saved in memory'
            });
        }
        
    } catch (error) {
        console.error('Save test error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Выход
app.post('/api/auth/logout', async (req, res) => {
    const sessionToken = req.cookies?.session_token;
    
    if (sessionToken) {
        if (db) {
            await db.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
        } else {
            memoryStore.sessions.delete(sessionToken);
        }
        
        res.clearCookie('session_token');
    }
    
    return res.json({ success: true });
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
            console.log('⚠️ Using in-memory storage (demo mode)');
            console.log('💡 Note: To use PostgreSQL, ensure container is running');
            console.log('   Command: docker ps');
            initMemoryStore();
        }
        
        app.listen(port, () => {
            console.log(`✅ Server running at http://localhost:${port}`);
            console.log('');
            console.log('📊 Available endpoints:');
            console.log('   • http://localhost:3000/                - Main page');
            console.log('   • http://localhost:3000/api/health      - Health check');
            console.log('   • http://localhost:3000/api/auth/login  - Login');
            console.log('   • http://localhost:3000/api/tests       - User tests');
            console.log('');
            console.log('👤 Demo accounts:');
            console.log('   • Admin:        admin / 1410');
            console.log('   • Any user:     any@email.com / anypassword');
            console.log('');
            console.log('🐛 Debug tools:');
            console.log('   • Check containers: docker ps');
            console.log('   • Check PostgreSQL: docker exec TestDataBase psql -U postgres -c "\\l"');
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.log('');
        console.log('💡 Starting in demo mode without database...');
        
        // Запускаем в демо режиме
        initMemoryStore();
        app.listen(port, () => {
            console.log(`✅ Server running in DEMO mode at http://localhost:${port}`);
            console.log('⚠️ Using in-memory storage');
        });
    }
}

startServer();