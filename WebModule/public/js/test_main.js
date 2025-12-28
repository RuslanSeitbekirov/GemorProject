// test_main.js - обновленная версия с поддержкой типов вопросов
let currentQuestionIndex = 0;
let correctAnswerCount = 0;
let testQuestions = [];
let testTimer = null;
let timeLeft = 0;

// Функция инициализации теста
function initTest() {
    console.log('=== Инициализация теста ===');
    
    // Пытаемся загрузить тест из localStorage
    const savedTest = localStorage.getItem('currentTest');
    
    if (savedTest) {
        try {
            const test = JSON.parse(savedTest);
            testQuestions = test.questions || [];
            
            console.log(`Тест загружен: "${test.title}"`);
            console.log(`Вопросов: ${testQuestions.length}`);
            console.log(`Время на выполнение: ${test.timeLimit || 'без ограничения'} минут`);
            
            // Устанавливаем таймер, если есть
            if (test.timeLimit && test.timeLimit > 0) {
                timeLeft = test.timeLimit * 60; // конвертируем в секунды
                startTimer();
            }
            
            // Отображаем информацию о тесте
            document.querySelector('h1').textContent = test.title || 'Тест';
            document.querySelector('h2').textContent = test.description || '';
            
        } catch (error) {
            console.error('Ошибка при загрузке теста:', error);
            alert('Ошибка при загрузке теста. Используется демо-тест.');
            loadDemoTest();
        }
    } else {
        console.log('Тест не найден в localStorage, загружаем демо-тест');
        loadDemoTest();
    }
    
    displayQuestion();
    setupEventListeners();
}

// Загрузка демо-теста
function loadDemoTest() {
    testQuestions = [
        {
            question: "Какое свойство CSS отвечает за управление пространством между границей и контентом элемента?",
            answers: ["margin", "border", "padding", "width"],
            correctAnswer: "padding",
            explanation: "Свойство padding устанавливает внутренние отступы между контентом элемента и его границей, увеличивая видимое пространство вокруг контента внутри элемента.",
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
            explanation: "Свойство position: absolute; позиционирует элемент относительно его ближайшего позиционированного предка вместо обычной поточной позиции.",
            type: "single"
        },
        {
            question: "Какие из этих свойств относятся к Flexbox?",
            answers: ["display: flex", "justify-content", "float", "flex-direction", "position"],
            correctAnswer: ["display: flex", "justify-content", "flex-direction"],
            explanation: "Flexbox включает свойства display: flex, justify-content, flex-direction, align-items и другие. Float и position не относятся к Flexbox.",
            type: "multiple"
        }
    ];
    
    console.log('Демо-тест загружен, вопросов:', testQuestions.length);
}

// Таймер
function startTimer() {
    const timerElement = document.querySelector('.timer');
    if (!timerElement) return;
    
    // Обновляем таймер каждую секунду
    testTimer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(testTimer);
            alert('Время вышло!');
            finishTest();
            return;
        }
        
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Отображение вопроса
function displayQuestion() {
    if (currentQuestionIndex >= testQuestions.length) {
        finishTest();
        return;
    }
    
    const question = testQuestions[currentQuestionIndex];
    const questionType = question.type || 'single';
    
    console.log(`Отображение вопроса ${currentQuestionIndex + 1}: ${question.question.substring(0, 50)}...`);
    console.log(`Тип вопроса: ${questionType}`);
    
    // Обновляем заголовок
    document.querySelector(".question-title").textContent = 
        `Вопрос ${currentQuestionIndex + 1}: ${question.question}`;
    
    // Обновляем счетчик вопросов
    const currentQuestionElement = document.getElementById("currentQuestion");
    if (currentQuestionElement) {
        currentQuestionElement.textContent = currentQuestionIndex + 1;
    }
    
    // Очищаем и создаем варианты ответов
    const answersList = document.querySelector('.answers-list');
    answersList.innerHTML = '';
    
    for (let i = 0; i < question.answers.length; i++) {
        const answerText = question.answers[i];
        if (!answerText) continue; // Пропускаем пустые ответы
        
        const listItem = document.createElement("li");
        listItem.className = "answer-item";
        
        const inputType = questionType === 'multiple' ? 'checkbox' : 'radio';
        const inputName = questionType === 'multiple' ? 
            `question${currentQuestionIndex}_answer${i}` : 
            `question${currentQuestionIndex}`;
        
        const input = document.createElement("input");
        input.type = inputType;
        input.id = `answer${currentQuestionIndex}_${i}`;
        input.name = inputName;
        input.value = answerText;
        
        const label = document.createElement("label");
        label.htmlFor = input.id;
        label.textContent = `${getStringByNumIter(i)} ${answerText}`;
        
        listItem.appendChild(input);
        listItem.appendChild(label);
        answersList.appendChild(listItem);
    }
}

// Получение буквы для варианта ответа
function getStringByNumIter(number) {
    const arrStr = ["A)", "B)", "C)", "D)", "E)", "F)"];
    return arrStr[number] || `${number + 1})`;
}

// Настройка обработчиков событий
function setupEventListeners() {
    const nextButton = document.querySelector(".next-button");
    if (nextButton) {
        nextButton.addEventListener("click", submitAnswer);
    }
}

// Отправка ответа
function submitAnswer() {
    const question = testQuestions[currentQuestionIndex];
    const questionType = question.type || 'single';
    
    let isCorrect = false;
    
    if (questionType === 'single') {
        // Один правильный ответ
        const selectedAnswer = document.querySelector(`input[name="question${currentQuestionIndex}"]:checked`);
        
        if (!selectedAnswer) {
            alert("Пожалуйста, выберите ответ");
            return;
        }
        
        isCorrect = selectedAnswer.value === question.correctAnswer;
        console.log(`Вопрос ${currentQuestionIndex + 1}: выбран ответ "${selectedAnswer.value}", правильный ответ "${question.correctAnswer}" - ${isCorrect ? 'верно' : 'неверно'}`);
        
    } else if (questionType === 'multiple') {
        // Несколько правильных ответов
        const selectedAnswers = document.querySelectorAll(`input[name^="question${currentQuestionIndex}"]:checked`);
        
        if (selectedAnswers.length === 0) {
            alert("Пожалуйста, выберите хотя бы один ответ");
            return;
        }
        
        const selectedValues = Array.from(selectedAnswers).map(input => input.value);
        const correctAnswers = question.correctAnswers || [];
        
        // Проверяем, что все выбранные ответы правильные и выбраны все правильные
        const allSelectedAreCorrect = selectedValues.every(val => correctAnswers.includes(val));
        const allCorrectAreSelected = correctAnswers.every(val => selectedValues.includes(val));
        
        isCorrect = allSelectedAreCorrect && allCorrectAreSelected;
        
        console.log(`Вопрос ${currentQuestionIndex + 1}: выбраны ответы ${JSON.stringify(selectedValues)}, правильные ответы ${JSON.stringify(correctAnswers)} - ${isCorrect ? 'верно' : 'неверно'}`);
    }
    
    if (isCorrect) {
        correctAnswerCount++;
        console.log(`Правильных ответов: ${correctAnswerCount}`);
    }
    
    // Показываем объяснение, если есть
    if (question.explanation) {
        alert(`Пояснение: ${question.explanation}`);
    }
    
    // Переходим к следующему вопросу
    nextQuestion();
}

// Следующий вопрос
function nextQuestion() {
    if (currentQuestionIndex < testQuestions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    } else {
        finishTest();
    }
}

// Завершение теста
function finishTest() {
    if (testTimer) {
        clearInterval(testTimer);
    }
    
    const score = (correctAnswerCount / testQuestions.length) * 100;
    console.log(`=== Тест завершен ===`);
    console.log(`Правильных ответов: ${correctAnswerCount} из ${testQuestions.length}`);
    console.log(`Результат: ${score.toFixed(1)}%`);
    
    if (score >= 60) {
        alert(`Вы успешно прошли тест!\nВаш результат: ${score.toFixed(1)}%\nПравильных ответов: ${correctAnswerCount} из ${testQuestions.length}`);
    } else {
        alert(`Тест не пройден.\nВаш результат: ${score.toFixed(1)}%\nПравильных ответов: ${correctAnswerCount} из ${testQuestions.length}\nПопробуйте еще раз!`);
    }
    
    // Сбрасываем тест
    resetTest();
}

// Сброс теста
function resetTest() {
    currentQuestionIndex = 0;
    correctAnswerCount = 0;
    testQuestions = [];
    timeLeft = 0;
    
    if (testTimer) {
        clearInterval(testTimer);
        testTimer = null;
    }
    
    // Очищаем localStorage
    localStorage.removeItem('currentTest');
    
    // Возвращаемся на главную
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 3000);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Страница теста загружена');
    initTest();
});