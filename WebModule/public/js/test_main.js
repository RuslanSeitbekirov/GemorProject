// test_main.js - адаптирован под новую структуру теста
let currentQuestionIndex = 0;
let correctAnswerCount = 0;
let testQuestions = [];
let testTimer = null;
let timeLeft = 0;
let testData = null;

async function initTest() {
    console.log('=== Инициализация теста ===');
    
    // Пытаемся загрузить тест
    testData = await loadTestData();
    
    if (!testData) {
        alert('Тест не найден. Возвращаемся на главную.');
        window.location.href = 'index.html';
        return;
    }
    
    testQuestions = testData.questions || [];
    timeLeft = testData.timeLimit || 0;
    
    console.log(`Тест загружен: "${testData.test_name}"`);
    console.log(`Вопросов: ${testQuestions.length}`);
    console.log(`Время на выполнение: ${timeLeft} секунд`);
    
    // Устанавливаем таймер
    if (timeLeft > 0) {
        startTimer();
    }
    
    // Отображаем информацию о тесте
    document.querySelector('h1').textContent = testData.test_name || 'Тест';
    document.querySelector('h2').textContent = testData.description || '';
    document.getElementById('totalQuestions').textContent = testQuestions.length;
    
    displayQuestion();
    setupEventListeners();
}

async function loadTestData() {
    // 1. Пробуем загрузить из localStorage
    const savedTest = localStorage.getItem('currentTest');
    if (savedTest) {
        try {
            return JSON.parse(savedTest);
        } catch (error) {
            console.error('Ошибка парсинга теста:', error);
        }
    }
    
    // 2. Пробуем загрузить из URL параметров
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('testId');
    
    if (testId) {
        // Загрузка теста с сервера
        return await loadTestFromServer(testId);
    }
    
    // 3. Демо-тест
    return loadDemoTest();
}

async function loadTestFromServer(testId) {
    try {
        const accessToken = localStorage.getItem('accessToken');
        const response = await fetch(`http://localhost:3000/api/tests/${testId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const test = await response.json();
            return test;
        }
    } catch (error) {
        console.error('Load test from server error:', error);
    }
    
    return null;
}

function loadDemoTest() {
    return {
        test_name: 'Демо-тест по CSS',
        description: 'Тест для демонстрации работы системы',
        timeLimit: 600,
        questions: [
            {
                question: "Какое свойство CSS отвечает за управление пространством между границей и контентом элемента?",
                answers: ["margin", "border", "padding", "width"],
                correctAnswer: "padding",
                explanation: "Свойство padding устанавливает внутренние отступы.",
                type: "single"
            },
            {
                question: "Что делает свойство position: absolute; в CSS?",
                answers: [
                    "Располагает элемент в потоке документа",
                    "Располагает элемент относительно окна браузера",
                    "Располагает элемент относительно его нормальной позиции",
                    "Располагает элемент относительно ближайшего позиционированного предка"
                ],
                correctAnswer: "Располагает элемент относительно ближайшего позиционированного предка",
                explanation: "position: absolute позиционирует элемент относительно позиционированного предка.",
                type: "single"
            },
            {
                question: "Какие из этих свойств относятся к Flexbox?",
                answers: ["display: flex", "justify-content", "float", "flex-direction", "position"],
                correctAnswer: ["display: flex", "justify-content", "flex-direction"],
                explanation: "Flexbox включает свойства display: flex, justify-content, flex-direction.",
                type: "multiple"
            }
        ]
    };
}

// Остальные функции (displayQuestion, submitAnswer, finishTest и т.д.)
// остаются похожими, но работают с новой структурой testData