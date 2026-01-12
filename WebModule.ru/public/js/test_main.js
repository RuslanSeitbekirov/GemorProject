// test_main.js - адаптирован под новую структуру теста
let currentQuestionIndex = 0;
let userAnswers = [];
let testQuestions = [];
let testTimer = null;
let timeLeft = 0;
let testData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initTest();
    setupEventListeners();
});

async function initTest() {
    console.log('=== Инициализация теста ===');
    
    // Пытаемся загрузить тест из разных источников
    testData = await loadTestData();
    
    if (!testData) {
        alert('Тест не найден. Возвращаемся на главную.');
        window.location.href = 'index.html';
        return;
    }
    
    // Извлекаем вопросы из структуры теста
    if (testData.test_data && testData.test_data.questions) {
        testQuestions = testData.test_data.questions;
        timeLeft = testData.test_data.timeLimit || testData.time_limit || 0;
    } else if (Array.isArray(testData)) {
        testQuestions = testData;
        timeLeft = 0;
    } else {
        alert('Неверный формат теста');
        window.location.href = 'index.html';
        return;
    }
    
    console.log(`Тест загружен: "${testData.test_name || 'Безымянный тест'}"`);
    console.log(`Вопросов: ${testQuestions.length}`);
    console.log(`Время на выполнение: ${timeLeft} секунд`);
    
    // Инициализируем массив ответов пользователя
    userAnswers = new Array(testQuestions.length).fill(null);
    
    // Устанавливаем информацию о тесте
    document.querySelector('h1').textContent = testData.test_name || 'Тест';
    document.querySelector('h2').textContent = testData.description || '';
    
    // Устанавливаем таймер
    if (timeLeft > 0) {
        startTimer();
        document.querySelector('.timer').style.display = 'block';
    } else {
        document.querySelector('.timer').style.display = 'none';
    }
    
    // Обновляем счетчик вопросов
    document.getElementById('currentQuestion').textContent = '1';
    document.querySelector('.question-counter').innerHTML = `<span id="currentQuestion">1</span> / ${testQuestions.length}`;
    
    displayQuestion();
}

async function loadTestData() {
    // 1. Пробуем загрузить из URL параметров (если перешли с take-test.html)
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('testId');
    
    if (testId) {
        // Загрузка теста с сервера
        const test = await loadTestFromServer(testId);
        if (test) return test;
    }
    
    // 2. Пробуем загрузить из localStorage (для пользовательских тестов)
    const savedTest = localStorage.getItem('currentTest');
    if (savedTest) {
        try {
            return JSON.parse(savedTest);
        } catch (error) {
            console.error('Ошибка парсинга теста:', error);
        }
    }
    
    // 3. Демо-тест
    return loadDemoTest();
}

async function loadTestFromServer(testId) {
    try {
        const response = await fetch(`http://localhost:3000/api/tests/${testId}`);
        
        if (response.ok) {
            const result = await response.json();
            return result.test;
        }
    } catch (error) {
        console.error('Load test from server error:', error);
    }
    
    return null;
}

function loadDemoTest() {
    return {
        test_name: 'Демо-тест по программированию',
        description: 'Тест для демонстрации работы системы',
        time_limit: 600,
        test_data: {
            questions: [
                {
                    question: "Какое ключевое слово используется для объявления переменной в JavaScript?",
                    answers: ["var", "let", "const", "все вышеперечисленные"],
                    correctAnswer: 3,
                    explanation: "В JavaScript можно использовать var, let и const для объявления переменных.",
                    type: "single"
                },
                {
                    question: "Какие из этих типов данных являются примитивными в JavaScript?",
                    answers: ["String", "Object", "Number", "Boolean", "Array"],
                    correctAnswers: [0, 2, 3],
                    explanation: "String, Number и Boolean являются примитивными типами данных. Object и Array - объекты.",
                    type: "multiple"
                },
                {
                    question: "Что возвращает метод map() у массива?",
                    answers: [
                        "Новый массив с результатами вызова функции для каждого элемента",
                        "Первый элемент, удовлетворяющий условию",
                        "Значение первого элемента массива",
                        "Индекс найденного элемента"
                    ],
                    correctAnswer: 0,
                    explanation: "Метод map() создает новый массив с результатами вызова функции для каждого элемента.",
                    type: "single"
                }
            ],
            timeLimit: 300
        }
    };
}

function displayQuestion() {
    if (currentQuestionIndex >= testQuestions.length) {
        finishTest();
        return;
    }
    
    const question = testQuestions[currentQuestionIndex];
    const questionContainer = document.querySelector('.question-container');
    
    if (!questionContainer) return;
    
    // Обновляем заголовок вопроса
    questionContainer.querySelector('.question-title').textContent = `Вопрос ${currentQuestionIndex + 1}: ${question.question}`;
    
    // Обновляем список ответов
    const answersList = questionContainer.querySelector('.answers-list');
    answersList.innerHTML = '';
    
    // Определяем тип вопроса
    const isMultiple = question.type === 'multiple';
    const inputType = isMultiple ? 'checkbox' : 'radio';
    const inputName = isMultiple ? `question_${currentQuestionIndex}` : 'answer';
    
    // Создаем варианты ответов
    question.answers.forEach((answer, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'answer-item';
        
        const inputId = `answer_${currentQuestionIndex}_${index}`;
        
        // Проверяем, был ли уже выбран этот ответ
        const isChecked = userAnswers[currentQuestionIndex] !== null && 
                         (isMultiple ? 
                          userAnswers[currentQuestionIndex].includes(index) : 
                          userAnswers[currentQuestionIndex] === index);
        
        listItem.innerHTML = `
            <input type="${inputType}" 
                   name="${inputName}" 
                   id="${inputId}" 
                   value="${index}"
                   ${isChecked ? 'checked' : ''}>
            <label for="${inputId}">${answer}</label>
        `;
        
        answersList.appendChild(listItem);
    });
    
    // Обновляем счетчик вопросов
    document.getElementById('currentQuestion').textContent = currentQuestionIndex + 1;
    document.querySelector('.question-counter').innerHTML = 
        `<span id="currentQuestion">${currentQuestionIndex + 1}</span> / ${testQuestions.length}`;
    
    // Обновляем текст кнопки
    const nextButton = document.querySelector('.next-button');
    if (currentQuestionIndex === testQuestions.length - 1) {
        nextButton.innerHTML = 'Завершить тест <img src="img/arrow-right-white.svg" alt="next-button-arrow">';
    } else {
        nextButton.innerHTML = 'Следующий вопрос <img src="img/arrow-right-white.svg" alt="next-button-arrow">';
    }
}

function setupEventListeners() {
    const nextButton = document.querySelector('.next-button');
    if (nextButton) {
        nextButton.addEventListener('click', submitAnswer);
    }
}

function submitAnswer() {
    const question = testQuestions[currentQuestionIndex];
    const isMultiple = question.type === 'multiple';
    
    let selectedAnswers;
    
    if (isMultiple) {
        // Для вопросов с несколькими правильными ответами
        const checkboxes = document.querySelectorAll(`input[name="question_${currentQuestionIndex}"]:checked`);
        selectedAnswers = Array.from(checkboxes).map(cb => parseInt(cb.value));
    } else {
        // Для вопросов с одним правильным ответом
        const radio = document.querySelector('input[name="answer"]:checked');
        selectedAnswers = radio ? parseInt(radio.value) : null;
    }
    
    // Сохраняем ответ пользователя
    userAnswers[currentQuestionIndex] = selectedAnswers;
    
    // Переходим к следующему вопросу или завершаем тест
    if (currentQuestionIndex < testQuestions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    } else {
        finishTest();
    }
}

function startTimer() {
    const timerElement = document.querySelector('.timer');
    if (!timerElement) return;
    
    // Обновляем таймер каждую секунду
    testTimer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(testTimer);
            finishTest();
            return;
        }
        
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Меняем цвет при малом остатке времени
        if (timeLeft < 60) {
            timerElement.style.color = '#dc3545';
            timerElement.style.fontWeight = 'bold';
        }
    }, 1000);
}

function finishTest() {
    if (testTimer) {
        clearInterval(testTimer);
    }
    
    // Вычисляем результаты
    let correctCount = 0;
    let results = [];
    
    testQuestions.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        let isCorrect = false;
        
        if (question.type === 'single') {
            isCorrect = userAnswer === question.correctAnswer;
        } else if (question.type === 'multiple') {
            // Для вопросов с несколькими ответами проверяем точное совпадение
            const userAnswersSorted = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
            const correctAnswersSorted = Array.isArray(question.correctAnswers) ? [...question.correctAnswers].sort() : [];
            
            isCorrect = JSON.stringify(userAnswersSorted) === JSON.stringify(correctAnswersSorted);
        }
        
        if (isCorrect) {
            correctCount++;
        }
        
        results.push({
            question: question.question,
            userAnswer: userAnswer,
            correctAnswer: question.type === 'single' ? question.correctAnswer : question.correctAnswers,
            isCorrect: isCorrect,
            explanation: question.explanation || ''
        });
    });
    
    const score = Math.round((correctCount / testQuestions.length) * 100);
    
    // Сохраняем результаты
    saveTestResults(score, results);
    
    // Показываем результаты
    showResults(score, results);
}

function showResults(score, results) {
    const mainElement = document.querySelector('main');
    if (!mainElement) return;
    
    let resultsHTML = `
        <div class="test-results" style="max-width: 800px; margin: 0 auto; padding: 40px; background: white; border-radius: 10px; box-shadow: 0 2px 20px rgba(0,0,0,0.1);">
            <h1 style="text-align: center; color: #333; margin-bottom: 30px;">Результаты теста</h1>
            
            <div style="text-align: center; margin-bottom: 40px;">
                <div style="font-size: 48px; font-weight: bold; color: ${score >= 70 ? '#28a745' : score >= 50 ? '#ffc107' : '#dc3545'}; margin-bottom: 10px;">
                    ${score}%
                </div>
                <div style="font-size: 18px; color: #666;">
                    ${correctCount} из ${testQuestions.length} правильных ответов
                </div>
            </div>
            
            <h2 style="color: #333; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Детальные результаты:</h2>
    `;
    
    results.forEach((result, index) => {
        const statusIcon = result.isCorrect ? '✅' : '❌';
        const statusColor = result.isCorrect ? '#28a745' : '#dc3545';
        
        resultsHTML += `
            <div style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 16px; color: #333;">Вопрос ${index + 1}: ${result.question}</h3>
                    <span style="font-size: 20px;">${statusIcon}</span>
                </div>
                
                <div style="margin-bottom: 10px;">
                    <div><strong>Ваш ответ:</strong> ${formatAnswer(result.userAnswer, testQuestions[index])}</div>
                    <div><strong>Правильный ответ:</strong> ${formatAnswer(result.correctAnswer, testQuestions[index])}</div>
                </div>
                
                ${result.explanation ? `
                    <div style="padding: 10px; background: white; border-radius: 5px; font-size: 14px; color: #666; border: 1px solid #e9ecef;">
                        <strong>Пояснение:</strong> ${result.explanation}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    resultsHTML += `
            <div style="text-align: center; margin-top: 40px;">
                <button onclick="window.location.href='take-test.html'" 
                        style="padding: 12px 30px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-right: 10px;">
                    Пройти другой тест
                </button>
                <button onclick="window.location.href='index.html'" 
                        style="padding: 12px 30px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    На главную
                </button>
            </div>
        </div>
    `;
    
    mainElement.innerHTML = resultsHTML;
}

function formatAnswer(answer, question) {
    if (answer === null || answer === undefined) {
        return 'Нет ответа';
    }
    
    if (Array.isArray(answer)) {
        if (answer.length === 0) return 'Нет ответа';
        return answer.map(idx => question.answers[idx]).join(', ');
    }
    
    if (typeof answer === 'number') {
        return question.answers[answer] || 'Неизвестный ответ';
    }
    
    return String(answer);
}

async function saveTestResults(score, results) {
    try {
        const sessionToken = document.cookie.replace(/(?:(?:^|.*;\s*)session_token\s*=\s*([^;]*).*$)|^.*$/, "$1");
        
        if (sessionToken) {
            // Получаем информацию о пользователе
            const sessionResponse = await fetch('http://localhost:3000/api/session/check', {
                credentials: 'include'
            });
            
            if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                
                if (sessionData.userData) {
                    // Сохраняем результаты в localStorage для истории
                    const testHistory = JSON.parse(localStorage.getItem('testHistory') || '[]');
                    testHistory.unshift({
                        testName: testData.test_name || 'Безымянный тест',
                        score: score,
                        date: new Date().toISOString(),
                        results: results
                    });
                    
                    // Сохраняем только последние 10 тестов
                    if (testHistory.length > 10) {
                        testHistory.pop();
                    }
                    
                    localStorage.setItem('testHistory', JSON.stringify(testHistory));
                    
                    // Можно также отправить результаты на сервер
                    console.log('Test results saved locally');
                }
            }
        }
    } catch (error) {
        console.error('Error saving test results:', error);
    }
}