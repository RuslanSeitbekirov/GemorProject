// Admin: получить всех пользователей
app.get('/api/admin/users', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
        const result = await db.query('SELECT id, email, username, is_admin, created_at FROM users ORDER BY created_at DESC');
        
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

// Сброс системы (только для демо)
app.post('/api/admin/reset', async (req, res) => {
    try {
        if (!db) {
            // В демо режиме просто очищаем память
            memoryStore.tests.clear();
            memoryStore.sessions.clear();
            
            return res.json({
                success: true,
                message: 'Demo system reset completed',
                timestamp: new Date().toISOString()
            });
        }
        
        // В реальной системе сбрасываем таблицы (осторожно!)
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