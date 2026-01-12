const { Pool } = require('pg');

async function checkSystem() {
    console.log('🔍 Проверка состояния системы...\n');
    
    const pool = new Pool({
        host: 'localhost',
        port: 5438,
        database: 'test_system',
        user: 'postgres',
        password: '12345'
    });
    
    try {
        // Проверяем подключение
        console.log('1. Проверка подключения к PostgreSQL...');
        await pool.query('SELECT NOW()');
        console.log('   ✅ Подключение успешно\n');
        
        // Проверяем таблицы
        console.log('2. Проверка таблиц...');
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log('   Найдены таблицы:');
        tables.rows.forEach(table => {
            console.log('   -', table.table_name);
        });
        console.log('');
        
        // Проверяем пользователей
        console.log('3. Проверка пользователей...');
        const users = await pool.query('SELECT id, email, username, is_admin FROM users');
        
        if (users.rows.length === 0) {
            console.log('   ❌ Пользователи не найдены');
        } else {
            console.log('   Найдено пользователей:', users.rows.length);
            users.rows.forEach(user => {
                console.log(`   - ${user.email} (${user.username}) ${user.is_admin ? '[ADMIN]' : ''}`);
            });
        }
        console.log('');
        
        // Проверяем админа
        console.log('4. Проверка администратора...');
        const admin = await pool.query("SELECT * FROM users WHERE email = 'admin@test.com'");
        
        if (admin.rows.length === 0) {
            console.log('   ❌ Администратор не найден');
            console.log('   Создайте администратора командой: node create-admin.js');
        } else {
            const adminUser = admin.rows[0];
            console.log('   ✅ Администратор найден:');
            console.log('      ID:', adminUser.id);
            console.log('      Email:', adminUser.email);
            console.log('      Имя:', adminUser.username);
            console.log('      Админ:', adminUser.is_admin ? 'Да' : 'Нет');
            console.log('      Подтвержден:', adminUser.email_verified ? 'Да' : 'Нет');
        }
        console.log('');
        
        console.log('🎯 РЕКОМЕНДАЦИИ:');
        console.log('   Для входа администратора используйте:');
        console.log('   Логин: admin (или admin@test.com)');
        console.log('   Пароль: 1410');
        console.log('');
        console.log('   Для обычных пользователей:');
        console.log('   Логин: любой email');
        console.log('   Пароль: любой (система отправит код подтверждения)');
        
    } catch (error) {
        console.error('❌ Ошибка проверки:', error.message);
        console.log('\n🔧 Устранение неполадок:');
        console.log('   1. Убедитесь, что Docker контейнер запущен: docker start TestDataBase');
        console.log('   2. Если базы нет, создайте её: node create-admin.js');
        console.log('   3. Проверьте настройки подключения в server.js');
    } finally {
        await pool.end();
    }
}

checkSystem();