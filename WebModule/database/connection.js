// database.js
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Пример запроса
async function getUserById(userId) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const values = [userId];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Database error:', error);
        throw error;
    }
}

module.exports = { pool, getUserById };