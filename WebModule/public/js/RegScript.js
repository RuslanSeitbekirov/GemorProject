// RegScript.js - обновленная версия для работы с API
document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.querySelector('.loginButton');
    const loginInput = document.getElementById('login');
    const passwordInput = document.getElementById('password');
    
    // Автоматический фокус на поле логина
    if (loginInput) loginInput.focus();
    
    loginButton.addEventListener('click', handleLogin); 
    
    // Обработка Enter
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    async function handleLogin() {
        const email = loginInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            alert('Введите email и пароль');
            return;
        }
        
        // Проверка администратора
        if (email.toLowerCase() === 'admin' && password === '1410') {
            const result = await auth.login('admin@test.com', '1410');
            if (result.error) {
                alert('Ошибка входа: ' + result.error);
            }
            return;
        }
        
        // Проверка email формата
        if (!email.includes('@')) {
            alert('Введите корректный email адрес');
            return;
        }
        
        const result = await auth.login(email, password);
        
        if (result.error) {
            alert('Ошибка входа: ' + result.error);
        } else if (result.status === 'needs_verification') {
            // Код уже отправлен, форма верификации показана
            console.log('Verification required');
        }
    }
});