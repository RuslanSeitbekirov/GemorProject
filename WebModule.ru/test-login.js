const bcrypt = require('bcryptjs');

async function testPassword() {
    console.log('🔐 Тестирование пароля администратора...\n');
    
    const password = '1410';
    
    console.log('1. Создание хешей:');
    
    // Создаем несколько хешей для теста
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);
    const hash3 = await bcrypt.hash(password, 12);
    
    console.log(`   Хеш (10 раундов): ${hash1.substring(0, 40)}...`);
    console.log(`   Хеш (10 раундов, другой): ${hash2.substring(0, 40)}...`);
    console.log(`   Хеш (12 раундов): ${hash3.substring(0, 40)}...`);
    console.log('');
    
    console.log('2. Проверка хешей:');
    
    // Проверяем все комбинации
    const tests = [
        ['Хеш1 с паролем 1410', hash1, password],
        ['Хеш2 с паролем 1410', hash2, password],
        ['Хеш3 с паролем 1410', hash3, password],
        ['Хеш1 с неправильным паролем', hash1, 'wrong'],
        ['Хеш1 с паролем 1410 (повторно)', hash1, password],
    ];
    
    for (const [testName, hash, testPassword] of tests) {
        const isValid = await bcrypt.compare(testPassword, hash);
        console.log(`   ${testName}: ${isValid ? '✅ Верный' : '❌ Неверный'}`);
    }
    
    console.log('\n3. Проверка в реальной базе:');
    console.log('   Запустите: node fix-admin-password.js');
    console.log('   Затем: node check-system.js');
}

testPassword();