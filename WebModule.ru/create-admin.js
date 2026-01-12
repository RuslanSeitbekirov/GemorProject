const { Pool } = require('pg');

async function createAdmin() {
    const pool = new Pool({
        host: 'localhost',
        port: 5438,
        database: 'postgres',
        user: 'postgres',
        password: '12345'
    });
    
    try {
        console.log('🔧 Подключение к PostgreSQL...');
        
        // Создаем базу если её нет
        await pool.query(`
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
        
        // Подключаемся к базе test_system
        const dbPool = new Pool({
            host: 'localhost',
            port: 5438,
            database: 'test_system',
            user: 'postgres',
            password: '12345'
        });
        
        console.log('✅ Подключение к test_system успешно');
        
        // Создаем таблицы если их нет
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
        
        console.log('✅ Таблица users создана/проверена');
        
        // Проверяем, есть ли админ
        const result = await dbPool.query(
            "SELECT * FROM users WHERE email = 'admin@test.com'"
        );
        
        if (result.rows.length === 0) {
            console.log('👑 Создание администратора...');
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('1410', 10);
            
            await dbPool.query(`
                INSERT INTO users (email, username, password_hash, is_admin, email_verified)
                VALUES ($1, $2, $3, TRUE, TRUE)
            `, ['admin@test.com', 'Admin', hash]);
            
            console.log('✅ Администратор создан:');
            console.log('   Email: admin@test.com');
            console.log('   Пароль: 1410');
            console.log('   Имя: Admin');
        } else {
            console.log('ℹ️ Администратор уже существует:');
            console.log('   Email:', result.rows[0].email);
            console.log('   Имя:', result.rows[0].username);
            console.log('   ID:', result.rows[0].id);
            
            // Обновляем пароль на всякий случай
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('1410', 10);
            await dbPool.query(
                "UPDATE users SET password_hash = $1 WHERE email = 'admin@test.com'",
                [hash]
            );
            console.log('✅ Пароль администратора обновлен');
        }
        
        await dbPool.end();
        await pool.end();
        
        console.log('🎉 Настройка завершена успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    }
}

createAdmin();