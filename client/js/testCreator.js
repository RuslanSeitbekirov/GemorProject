// testCreator.js - обновленная версия с работой через API
class TestCreator {
    constructor() {
        this.API_BASE = 'http://localhost:3000/api';
        this.currentTest = {
            title: '',
            description: '',
            timeLimit: 30,
            questionsCount: 5,
            answersCount: 4,
            questions: [],
            currentQuestionIndex: 0
        };
        this.init();
    }
    
    async init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initElements();
            this.loadMyTests();
        });
    }
    
    initElements() {
        // Настройки теста
        this.testTitle = document.getElementById('testTitle');
        this.testDescription = document.getElementById('testDescription');
        this.questionsCount = document.getElementById('questionsCount');
        this.answersCount = document.getElementById('answersCount');
        this.testTime = document.getElementById('testTime');
        
        // Кнопки
        this.setupContinueBtn = document.getElementById('setupContinueBtn');
        this.prevQuestionBtn = document.getElementById('prevQuestionBtn');
        this.nextQuestionBtn = document.getElementById('nextQuestionBtn');
        this.saveQuestionBtn = document.getElementById('saveQuestionBtn');
        this.backToSetupBtn = document.getElementById('backToSetupBtn');
        this.finishTestBtn = document.getElementById('finishTestBtn');
        this.addAnswerBtn = document.getElementById('addAnswerBtn');
        this.removeAnswerBtn = document.getElementById('removeAnswerBtn');
        
        // Контейнеры
        this.questionsEditor = document.getElementById('questionsEditor');
        this.testSetupCard = document.getElementById('testSetupCard');
        this.answersContainer = document.getElementById('answersContainer');
        this.questionDots = document.getElementById('questionDots');
        
        // Текстовые элементы
        this.questionText = document.getElementById('questionText');
        this.questionExplanation = document.getElementById('questionExplanation');
        this.currentQuestionNumber = document.getElementById('currentQuestionNumber');
        this.currentTestTitle = document.getElementById('currentTestTitle');
        this.questionsProgress = document.getElementById('questionsProgress');
        
        // Устанавливаем обработчики событий
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.setupContinueBtn) {
            this.setupContinueBtn.addEventListener('click', () => this.setupTest());
        }
        
        if (this.prevQuestionBtn) {
            this.prevQuestionBtn.addEventListener('click', () => this.prevQuestion());
        }
        
        if (this.nextQuestionBtn) {
            this.nextQuestionBtn.addEventListener('click', () => this.nextQuestion());
        }
        
        if (this.saveQuestionBtn) {
            this.saveQuestionBtn.addEventListener('click', () => this.saveQuestion());
        }
        
        if (this.backToSetupBtn) {
            this.backToSetupBtn.addEventListener('click', () => this.backToSetup());
        }
        
        if (this.finishTestBtn) {
            this.finishTestBtn.addEventListener('click', () => this.finishTest());
        }
        
        if (this.addAnswerBtn) {
            this.addAnswerBtn.addEventListener('click', () => this.addAnswer());
        }
        
        if (this.removeAnswerBtn) {
            this.removeAnswerBtn.addEventListener('click', () => this.removeAnswer());
        }
    }
    
    setupTest() {
        const title = this.testTitle.value.trim();
        if (!title) {
            alert('Введите название теста');
            return;
        }
        
        this.currentTest.title = title;
        this.currentTest.description = this.testDescription.value;
        this.currentTest.timeLimit = parseInt(this.testTime.value) || 0;
        this.currentTest.questionsCount = parseInt(this.questionsCount.value) || 5;
        this.currentTest.answersCount = parseInt(this.answersCount.value) || 4;
        
        // Инициализируем массив вопросов
        this.currentTest.questions = [];
        for (let i = 0; i < this.currentTest.questionsCount; i++) {
            this.currentTest.questions.push({
                id: i + 1,
                question: '',
                answers: Array(this.currentTest.answersCount).fill(''),
                correctAnswer: '',
                correctAnswers: [],
                explanation: '',
                type: 'single'
            });
        }
        
        // Показываем редактор вопросов
        this.testSetupCard.style.display = 'none';
        this.questionsEditor.style.display = 'block';
        
        this.currentTestTitle.textContent = this.currentTest.title;
        this.updateQuestionDots();
        this.displayQuestion();
    }
    
    updateQuestionDots() {
        if (!this.questionDots) return;
        
        this.questionDots.innerHTML = '';
        for (let i = 0; i < this.currentTest.questionsCount; i++) {
            const dot = document.createElement('div');
            dot.className = 'question-dot';
            if (i === this.currentTest.currentQuestionIndex) {
                dot.classList.add('active');
            }
            if (this.currentTest.questions[i].question) {
                dot.classList.add('saved');
            }
            dot.addEventListener('click', () => {
                this.currentTest.currentQuestionIndex = i;
                this.displayQuestion();
            });
            this.questionDots.appendChild(dot);
        }
    }
    
    displayQuestion() {
        const question = this.currentTest.questions[this.currentTest.currentQuestionIndex];
        
        this.currentQuestionNumber.textContent = `№${question.id}`;
        this.questionsProgress.textContent = `Вопрос ${question.id} из ${this.currentTest.questionsCount}`;
        this.questionText.value = question.question;
        this.questionExplanation.value = question.explanation || '';
        
        // Устанавливаем тип вопроса
        const questionTypeRadios = document.getElementsByName('questionType');
        for (let radio of questionTypeRadios) {
            radio.checked = radio.value === question.type;
        }
        
        // Отображаем варианты ответов
        this.displayAnswers();
        
        // Обновляем навигацию
        this.prevQuestionBtn.disabled = this.currentTest.currentQuestionIndex === 0;
        this.nextQuestionBtn.disabled = this.currentTest.currentQuestionIndex === this.currentTest.questionsCount - 1;
        this.updateQuestionDots();
    }
    
    displayAnswers() {
        if (!this.answersContainer) return;
        
        const question = this.currentTest.questions[this.currentTest.currentQuestionIndex];
        const isMultiple = question.type === 'multiple';
        
        this.answersContainer.innerHTML = `
            <h5>Варианты ответов (отметьте правильные):</h5>
        `;
        
        question.answers.forEach((answer, index) => {
            const answerItem = document.createElement('div');
            answerItem.className = 'answer-item';
            
            const inputType = isMultiple ? 'checkbox' : 'radio';
            const inputName = isMultiple ? `answers_${question.id}` : 'correctAnswer';
            
            answerItem.innerHTML = `
                <input type="${inputType}" 
                       name="${inputName}" 
                       value="${index}" 
                       id="answer_${index}"
                       ${(isMultiple ? question.correctAnswers.includes(index) : question.correctAnswer === index) ? 'checked' : ''}>
                <div class="answer-text">
                    <input type="text" 
                           class="answer-input" 
                           value="${answer}" 
                           placeholder="Вариант ответа ${index + 1}"
                           data-index="${index}"
                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 3px;">
                </div>
            `;
            
            this.answersContainer.appendChild(answerItem);
        });
        
        // Добавляем обработчики для полей ввода
        const answerInputs = this.answersContainer.querySelectorAll('.answer-input');
        answerInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                question.answers[index] = e.target.value;
            });
        });
    }
    
    addAnswer() {
        const question = this.currentTest.questions[this.currentTest.currentQuestionIndex];
        if (question.answers.length >= 10) {
            alert('Максимум 10 вариантов ответов');
            return;
        }
        
        question.answers.push('');
        this.displayAnswers();
    }
    
    removeAnswer() {
        const question = this.currentTest.questions[this.currentTest.currentQuestionIndex];
        if (question.answers.length <= 2) {
            alert('Минимум 2 варианта ответа');
            return;
        }
        
        question.answers.pop();
        
        // Обновляем правильные ответы
        if (question.type === 'single' && question.correctAnswer >= question.answers.length) {
            question.correctAnswer = '';
        } else if (question.type === 'multiple') {
            question.correctAnswers = question.correctAnswers.filter(idx => idx < question.answers.length);
        }
        
        this.displayAnswers();
    }
    
    saveQuestion() {
        const question = this.currentTest.questions[this.currentTest.currentQuestionIndex];
        const questionText = this.questionText.value.trim();
        
        if (!questionText) {
            alert('Введите текст вопроса');
            return;
        }
        
        question.question = questionText;
        question.explanation = this.questionExplanation.value;
        
        // Получаем тип вопроса
        const questionTypeRadios = document.getElementsByName('questionType');
        for (let radio of questionTypeRadios) {
            if (radio.checked) {
                question.type = radio.value;
                break;
            }
        }
        
        // Получаем правильные ответы
        if (question.type === 'single') {
            const correctAnswerRadio = document.querySelector('input[name="correctAnswer"]:checked');
            question.correctAnswer = correctAnswerRadio ? parseInt(correctAnswerRadio.value) : '';
        } else if (question.type === 'multiple') {
            const correctAnswerCheckboxes = document.querySelectorAll('input[name^="answers_"]:checked');
            question.correctAnswers = Array.from(correctAnswerCheckboxes).map(cb => parseInt(cb.value));
        }
        
        // Проверяем, что выбран хотя бы один правильный ответ
        const hasCorrectAnswer = question.type === 'single' 
            ? question.correctAnswer !== '' 
            : question.correctAnswers.length > 0;
        
        if (!hasCorrectAnswer) {
            alert('Выберите хотя бы один правильный ответ');
            return;
        }
        
        // Проверяем, что все варианты ответов заполнены
        const emptyAnswers = question.answers.filter(answer => !answer.trim());
        if (emptyAnswers.length > 0) {
            alert('Заполните все варианты ответов');
            return;
        }
        
        alert('Вопрос сохранен!');
        this.updateQuestionDots();
        
        // Автоматически переходим к следующему вопросу
        if (this.currentTest.currentQuestionIndex < this.currentTest.questionsCount - 1) {
            this.nextQuestion();
        }
    }
    
    prevQuestion() {
        if (this.currentTest.currentQuestionIndex > 0) {
            this.currentTest.currentQuestionIndex--;
            this.displayQuestion();
        }
    }
    
    nextQuestion() {
        if (this.currentTest.currentQuestionIndex < this.currentTest.questionsCount - 1) {
            this.currentTest.currentQuestionIndex++;
            this.displayQuestion();
        }
    }
    
    backToSetup() {
        if (confirm('Вы уверены? Все несохраненные изменения будут потеряны.')) {
            this.questionsEditor.style.display = 'none';
            this.testSetupCard.style.display = 'block';
        }
    }
    
    async finishTest() {
        // Проверяем, что все вопросы заполнены
        const incompleteQuestions = this.currentTest.questions.filter(q => !q.question.trim());
        if (incompleteQuestions.length > 0) {
            alert('Заполните все вопросы перед завершением теста');
            return;
        }
        
        // Преобразуем данные в формат для сохранения
        const testData = {
            questions: this.currentTest.questions.map(q => {
                const questionData = {
                    question: q.question,
                    answers: q.answers,
                    type: q.type,
                    explanation: q.explanation || ''
                };
                
                if (q.type === 'single') {
                    questionData.correctAnswer = q.correctAnswer;
                } else {
                    questionData.correctAnswers = q.correctAnswers;
                }
                
                return questionData;
            }),
            timeLimit: this.currentTest.timeLimit * 60 // Конвертируем в секунды
        };
        
        // Сохраняем тест на сервер
        const success = await this.saveTestToServer(testData);
        
        if (success) {
            alert('Тест успешно создан!');
            window.location.href = 'my-tests.html';
        }
    }
    
    async saveTestToServer(testData) {
        const accessToken = localStorage.getItem('accessToken');
        
        if (!accessToken) {
            alert('Требуется авторизация');
            window.location.href = 'Registration.html';
            return false;
        }
        
        const testToSave = {
            test_name: this.currentTest.title,
            description: this.currentTest.description || '',
            time_limit: this.currentTest.timeLimit,
            test_data: testData
        };
        
        try {
            const response = await fetch(`${this.API_BASE}/tests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(testToSave)
            });
            
            const result = await response.json();
            
            if (result.success) {
                return true;
            } else {
                alert('Ошибка сохранения теста: ' + (result.error || 'Неизвестная ошибка'));
                return false;
            }
        } catch (error) {
            console.error('Save test error:', error);
            alert('Ошибка сети при сохранении теста');
            return false;
        }
    }
    
    async loadMyTests() {
        const accessToken = localStorage.getItem('accessToken');
        
        if (!accessToken) {
            const myTestsList = document.getElementById('myTestsList');
            if (myTestsList) {
                myTestsList.innerHTML = '<p>Требуется авторизация</p>';
            }
            return;
        }
        
        try {
            const response = await fetch(`${this.API_BASE}/tests`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            const result = await response.json();
            
            if (result.tests) {
                this.displayTests(result.tests);
            }
        } catch (error) {
            console.error('Load tests error:', error);
            this.displayError('Ошибка загрузки тестов');
        }
    }
    
    displayTests(tests) {
        const myTestsList = document.getElementById('myTestsList');
        if (!myTestsList) return;
        
        if (tests.length === 0) {
            myTestsList.innerHTML = `
                <div class="empty-state">
                    <h3>У вас пока нет созданных тестов</h3>
                    <p>Создайте свой первый тест, чтобы начать работу</p>
                    <button onclick="window.location.href='create-test.html'" class="btn-create">
                        Создать первый тест
                    </button>
                </div>
            `;
            return;
        }
        
        myTestsList.innerHTML = tests.map(test => `
            <div class="test-card">
                <h3>${test.test_name}</h3>
                <div class="test-description">${test.description || 'Без описания'}</div>
                
                <div class="test-meta">
                    <span class="meta-item">${test.test_data.questions?.length || 0} вопросов</span>
                    ${test.time_limit ? `<span class="meta-item">${test.time_limit} мин</span>` : ''}
                    <span class="meta-item">Создан: ${new Date(test.created_at).toLocaleDateString()}</span>
                </div>
                
                <div class="test-actions">
                    <button class="action-btn btn-view" onclick="testCreator.viewTestStructure(${test.id})">
                        Посмотреть структуру
                    </button>
                    <button class="action-btn btn-edit" onclick="testCreator.editTest(${test.id})">
                        Редактировать
                    </button>
                    <button class="action-btn btn-delete" onclick="testCreator.deleteTest(${test.id})">
                        Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    async viewTestStructure(testId) {
        try {
            const response = await fetch(`${this.API_BASE}/tests/${testId}`);
            const result = await response.json();
            
            if (result.test) {
                const test = result.test;
                const structureText = `const testQuestions = ${JSON.stringify(test.test_data.questions, null, 2)};`;
                
                const newWindow = window.open();
                newWindow.document.write(`
                    <html>
                    <head>
                        <title>Структура теста: ${test.test_name}</title>
                        <style>
                            body { font-family: monospace; padding: 20px; background: #f5f5f5; }
                            pre { background: white; padding: 20px; border-radius: 5px; border: 1px solid #ddd; overflow-x: auto; }
                            button { margin: 10px 5px; padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
                            .container { max-width: 800px; margin: 0 auto; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h2>Структура теста: ${test.test_name}</h2>
                            <p><strong>Описание:</strong> ${test.description || 'Нет описания'}</p>
                            <p><strong>Время:</strong> ${test.time_limit || 0} минут</p>
                            <p><strong>Количество вопросов:</strong> ${test.test_data.questions?.length || 0}</p>
                            <button onclick="copyToClipboard()">Копировать в буфер</button>
                            <button onclick="window.close()">Закрыть</button>
                            <pre id="structure">${structureText}</pre>
                        </div>
                        <script>
                            function copyToClipboard() {
                                const text = document.getElementById('structure').textContent;
                                navigator.clipboard.writeText(text).then(() => {
                                    alert('Структура теста скопирована в буфер обмена!');
                                });
                            }
                        <\/script>
                    </body>
                    </html>
                `);
            }
        } catch (error) {
            console.error('View test structure error:', error);
            alert('Ошибка при загрузке структуры теста');
        }
    }
    
    async editTest(testId) {
        try {
            const response = await fetch(`${this.API_BASE}/tests/${testId}`);
            const result = await response.json();
            
            if (result.test) {
                const test = result.test;
                
                // Сохраняем тест в localStorage для редактирования
                localStorage.setItem('editingTest', JSON.stringify(test));
                
                // Заполняем форму редактирования
                window.location.href = `create-test.html?edit=${testId}`;
            }
        } catch (error) {
            console.error('Edit test error:', error);
            alert('Ошибка при загрузке теста для редактирования');
        }
    }
    
    async deleteTest(testId) {
        if (!confirm('Вы уверены, что хотите удалить этот тест? Это действие нельзя отменить.')) return;
        
        const accessToken = localStorage.getItem('accessToken');
        
        try {
            const response = await fetch(`${this.API_BASE}/tests/${testId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('Тест удален');
                this.loadMyTests();
            } else {
                alert('Ошибка удаления теста: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Delete test error:', error);
            alert('Ошибка сети при удалении теста');
        }
    }
    
    displayError(message) {
        const myTestsList = document.getElementById('myTestsList');
        if (myTestsList) {
            myTestsList.innerHTML = `
                <div class="error-state">
                    <h3>Ошибка</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" class="btn-retry">
                        Повторить попытку
                    </button>
                </div>
            `;
        }
    }
}

const testCreator = new TestCreator();
window.testCreator = testCreator;