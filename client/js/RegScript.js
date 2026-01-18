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
        const emailInput = loginInput.value.trim();
        const password = passwordInput.value;
        
        if (!emailInput) {
            alert('Введите email или логин администратора');
            return;
        }
        
        if (!password) {
            alert('Введите пароль');
            return;
        }
        
        console.log('Login attempt:', emailInput);
        
        // Если введен "admin" (без @), используем специальную обработку
        if (emailInput.toLowerCase() === 'admin' && password === '1410') {
            console.log('Admin login detected');
            const result = await auth.login('admin@test.com', '1410');
            if (result.error) {
                alert('Ошибка входа администратора: ' + result.error);
            }
            return;
        }
        
        // Проверка email формата для обычных пользователей
        if (!emailInput.includes('@')) {
            alert('Введите корректный email адрес (должен содержать @)');
            return;
        }
        
        const result = await auth.login(emailInput, password);
        
        if (result.error) {
            alert('Ошибка входа: ' + result.error);
        } else if (result.status === 'needs_verification') {
            console.log('Verification required');
        }
    }
});