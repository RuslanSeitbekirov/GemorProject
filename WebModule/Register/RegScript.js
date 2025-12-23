// Используем querySelector для получения первого элемента или getElementById
const loginButton = document.querySelector('.loginButton');
const loginButtonYandex = document.querySelector('.loginButtonYandex');
const loginButtonGithub = document.querySelector('.loginButtonGithub');

// Обработчик для обычного входа (логин/пароль)
loginButton.addEventListener('click', () => {
    const login = document.getElementById('login').value; // добавлен .value
    const password = document.getElementById('password').value; // исправлен id
    
    if (login === "test" && password === "1014") { // === вместо ==
        // alert("Успешный вход!");
    } else {
        alert("Неверный логин или пароль!");
    }
});

// Обработчик для ЯндексID
loginButtonYandex.addEventListener('click', () => {
    alert("Перенаправление на Яндекс ID...");
    // В реальном приложении здесь будет редирект:
    // window.location.href = "/login?type=yandex";
});

// Обработчик для GitHub
loginButtonGithub.addEventListener('click', () => {
    alert("Перенаправление на GitHub...");
    // В реальном приложении здесь будет редирект:
    // window.location.href = "/login?type=github";
});