const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');

const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const testRoutes = require('./routes/testRoutes');

const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Redis клиент
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis'));

// Сессии с Redis store
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 часа
    }
}));

// Маршруты
app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/tests', testRoutes);

// Проверка здоровья
app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = await checkDatabase();
        res.json({
            status: 'healthy',
            database: dbStatus ? 'connected' : 'memory',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Статические файлы
app.use(express.static('../client'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

async function checkDatabase() {
    // Проверка соединения с базой данных
    return true; // В реальности нужно проверить соединение
}