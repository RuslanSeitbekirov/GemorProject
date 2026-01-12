const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: 'localhost',
    port: 5438,
    database: 'test_system',
    user: 'postgres',
    password: '12345'
});

async function createNewAdmin() {
    const hash = await bcrypt.hash('1410', 10);
    
    // Удаляем старого админа если есть
    await pool.query("DELETE FROM users WHERE email = 'admin@test.com'");
    
    // Создаем нового
    await pool.query(`
        INSERT INTO users (email, username, password_hash, is_admin, email_verified)
        VALUES ('admin@test.com', 'Admin', $1, TRUE, TRUE)
    `, [hash]);
    
    console.log('✅ Новый администратор создан');
    console.log('   Email: admin@test.com');
    console.log('   Пароль: 1410');
    
    await pool.end();
}

createNewAdmin();