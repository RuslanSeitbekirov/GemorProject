const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function fixAdmin() {
    console.log('🔧 Исправление администратора...\n');
    
    const pool = new Pool({
        host: 'localhost',
        port: 5438,
        database: 'test_system',
        user: 'postgres',
        password: '12345'
    });
    
    try {
        console.log('1. Подключение к test_system...');
        await pool.query('SELECT NOW()');
        console.log('✅ Подключение успешно\n');
        
        // Смотрим текущих пользователей
        console.log('2. Текущие пользователи в системе:');
        const users = await pool.query('SELECT id, email, username, is_admin FROM users ORDER BY id');
        
        if (users.rows.length === 0) {
            console.log('❌ Пользователей нет! Создаю администратора...\n');
        } else {
            users.rows.forEach(user => {
                console.log(`   👤 ID: ${user.id}, Email: ${user.email}, Имя: ${user.username}, Админ: ${user.is_admin ? '✅' : '❌'}`);
            });
        }
        
        // Создаем или обновляем пароль администратора
        console.log('\n3. Настройка администратора...');
        const password = '1410';
        const hash = await bcrypt.hash(password, 10);
        console.log(`   Пароль: ${password}`);
        console.log(`   Хеш: ${hash.substring(0, 50)}...\n`);
        
        // Проверяем, есть ли admin@test.com
        const adminResult = await pool.query(
            "SELECT * FROM users WHERE email = 'admin@test.com'"
        );
        
        if (adminResult.rows.length === 0) {
            // Создаем нового администратора
            console.log('👑 Создаю нового администратора...');
            const result = await pool.query(`
                INSERT INTO users (email, username, password_hash, is_admin, email_verified)
                VALUES ($1, $2, $3, TRUE, TRUE)
                RETURNING id, email, username
            `, ['admin@test.com', 'Admin', hash]);
            
            const admin = result.rows[0];
            console.log(`✅ Администратор создан:`);
            console.log(`   ID: ${admin.id}`);
            console.log(`   Email: ${admin.email}`);
            console.log(`   Имя: ${admin.username}`);
        } else {
            // Обновляем существующего администратора
            const admin = adminResult.rows[0];
            console.log(`👑 Обновляю существующего администратора (ID: ${admin.id})...`);
            
            await pool.query(`
                UPDATE users 
                SET password_hash = $1, 
                    username = 'Admin',
                    is_admin = TRUE,
                    email_verified = TRUE
                WHERE id = $2
            `, [hash, admin.id]);
            
            console.log(`✅ Администратор обновлен:`);
            console.log(`   ID: ${admin.id}`);
            console.log(`   Email: ${admin.email}`);
            console.log(`   Новый пароль установлен: 1410`);
        }
        
        // Проверяем пароль
        console.log('\n4. Проверка пароля...');
        const checkResult = await pool.query(
            "SELECT password_hash FROM users WHERE email = 'admin@test.com'"
        );
        
        if (checkResult.rows.length > 0) {
            const storedHash = checkResult.rows[0].password_hash;
            const isValid = await bcrypt.compare('1410', storedHash);
            
            console.log(`   Хранимый хеш: ${storedHash.substring(0, 50)}...`);
            console.log(`   Проверка пароля '1410': ${isValid ? '✅ ВЕРНО' : '❌ НЕВЕРНО'}`);
            
            if (!isValid) {
                console.log('   ⚠️ Пароль не совпадает! Исправляю...');
                const newHash = await bcrypt.hash('1410', 12);
                await pool.query(
                    "UPDATE users SET password_hash = $1 WHERE email = 'admin@test.com'",
                    [newHash]
                );
                console.log('   ✅ Пароль исправлен');
            }
        }
        
        // Очищаем старые сессии
        console.log('\n5. Очистка старых сессий...');
        await pool.query("DELETE FROM user_sessions WHERE expires_at < NOW()");
        const deleted = await pool.query("SELECT COUNT(*) as count FROM user_sessions");
        console.log(`   Текущих сессий: ${deleted.rows[0].count}`);
        
        // Проверяем логи
        console.log('\n6. Проверка логов...');
        const logs = await pool.query(`
            SELECT id, user_id, username, email, action, action_time 
            FROM user_logs 
            ORDER BY action_time DESC 
            LIMIT 5
        `);
        
        console.log('   Последние 5 записей:');
        logs.rows.forEach(log => {
            const time = new Date(log.action_time).toLocaleTimeString();
            console.log(`   📝 [${time}] ${log.username || 'N/A'}: ${log.action}`);
        });
        
        await pool.end();
        
        console.log('\n🎉 АДМИНИСТРАТОР ИСПРАВЛЕН!');
        console.log('=========================================');
        console.log('Для входа используйте:');
        console.log('   Логин: admin (или admin@test.com)');
        console.log('   Пароль: 1410');
        console.log('=========================================\n');
        
    } catch (error) {
        console.error('\n❌ ОШИБКА:', error.message);
        console.log('\n🔧 Возможные решения:');
        console.log('1. Проверьте, что Docker контейнер запущен');
        console.log('2. Проверьте подключение к PostgreSQL');
        console.log('3. Проверьте, существует ли база test_system');
        
        process.exit(1);
    }
}

fixAdmin();