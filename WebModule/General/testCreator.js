// testCreator.js - упрощенная версия для текущей структуры
class TestCreator {
    constructor() {
        this.currentTest = null;
        this.currentQuestionIndex = 0;
        this.init();
    }
    
    init() {
        // Назначаем обработчики после загрузки DOM
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('setupContinueBtn')) {
                document.getElementById('setupContinueBtn').addEventListener('click', () => this.startQuestionsCreation());
                document.getElementById('backToSetupBtn').addEventListener('click', () => this.backToSetup());
                document.getElementById('addAnswerBtn').addEventListener('click', () => this.addAnswerOption());
                document.getElementById('removeAnswerBtn').addEventListener('click', () => this.removeAnswerOption());
                document.getElementById('saveQuestionBtn').addEventListener('click', () => this.saveQuestion());
                document.getElementById('finishTestBtn').addEventListener('click', () => this.finishTest());
                document.getElementById('prevQuestionBtn').addEventListener('click', () => this.prevQuestion());
                document.getElementById('nextQuestionBtn').addEventListener('click', () => this.nextQuestion());
                
                this.loadMyTests();
            }
        });
    }
    
    startQuestionsCreation() {
        const testTitle = document.getElementById('testTitle').value.trim();
        const questionsCount = parseInt(document.getElementById('questionsCount').value) || 5;
        
        if (!testTitle) {
            alert('Введите название теста');
            return;
        }
        
        this.currentTest = {
            id: Date.now(),
            title: testTitle,
            description: document.getElementById('testDescription').value.trim(),
            questionsCount: questionsCount,
            answersCount: parseInt(document.getElementById('answersCount').value) || 4,
            timeLimit: parseInt(document.getElementById('testTime').value) || 0,
            createdAt: new Date().toLocaleString(),
            creatorId: localStorage.getItem('userId') || 'anonymous',
            questions: []
        };
        
        // Создаем пустые вопросы
        for (let i = 0; i < questionsCount; i++) {
            this.currentTest.questions.push({
                id: i + 1,
                text: '',
                type: 'single',
                answers: [],
                correctAnswers: [],
                explanation: ''
            });
        }
        
        this.currentQuestionIndex = 0;
        
        // Переключаемся на создание вопросов
        document.getElementById('testSetupCard').style.display = 'none';
        document.getElementById('questionsEditor').style.display = 'block';
        document.getElementById('currentTestTitle').textContent = testTitle;
        
        this.renderQuestion();
    }
    
    renderQuestion() {
        if (!this.currentTest) return;
        
        const question = this.currentTest.questions[this.currentQuestionIndex];
        const answersCount = this.currentTest.answersCount;
        
        // Обновляем UI
        document.getElementById('currentQuestionNumber').textContent = this.currentQuestionIndex + 1;
        document.getElementById('questionsProgress').textContent = 
            `Вопрос ${this.currentQuestionIndex + 1} из ${this.currentTest.questionsCount}`;
        
        document.getElementById('questionText').value = question.text || '';
        document.getElementById('questionExplanation').value = question.explanation || '';
        
        // Тип вопроса
        const typeRadios = document.getElementsByName('questionType');
        typeRadios.forEach(radio => {
            radio.checked = radio.value === question.type;
        });
        
        // Очищаем и создаем ответы
        const answersContainer = document.getElementById('answersContainer');
        answersContainer.innerHTML = '<h5>Варианты ответов (отметьте правильные):</h5>';
        
        for (let i = 0; i < answersCount; i++) {
            const answerDiv = document.createElement('div');
            answerDiv.className = 'answer-item';
            
            const inputType = question.type === 'multiple' ? 'checkbox' : 'radio';
            const answerText = question.answers[i] ? question.answers[i].text : '';
            const isCorrect = question.correctAnswers.includes(i);
            
            answerDiv.innerHTML = `
                <input type="${inputType}" name="answer${this.currentQuestionIndex}" 
                       ${isCorrect ? 'checked' : ''} data-index="${i}">
                <input type="text" class="answer-text" placeholder="Вариант ответа ${i + 1}"
                       value="${answerText}" data-index="${i}">
            `;
            
            answersContainer.appendChild(answerDiv);
        }
        
        // Обновляем навигацию
        this.updateNavigationDots();
    }
    
    updateNavigationDots() {
        const dotsContainer = document.getElementById('questionDots');
        dotsContainer.innerHTML = '';
        
        for (let i = 0; i < this.currentTest.questionsCount; i++) {
            const dot = document.createElement('div');
            dot.className = 'question-dot';
            dot.dataset.index = i;
            
            if (i === this.currentQuestionIndex) {
                dot.classList.add('active');
            }
            
            if (this.currentTest.questions[i].text) {
                dot.classList.add('saved');
            }
            
            dot.addEventListener('click', () => this.goToQuestion(i));
            dotsContainer.appendChild(dot);
        }
        
        // Кнопки навигации
        document.getElementById('prevQuestionBtn').disabled = this.currentQuestionIndex === 0;
        document.getElementById('nextQuestionBtn').disabled = 
            this.currentQuestionIndex === this.currentTest.questionsCount - 1;
    }
    
    saveQuestion() {
        const question = this.currentTest.questions[this.currentQuestionIndex];
        const questionText = document.getElementById('questionText').value.trim();
        
        if (!questionText) {
            alert('Введите текст вопроса');
            return;
        }
        
        // Сохраняем вопрос
        question.text = questionText;
        question.type = document.querySelector('input[name="questionType"]:checked').value;
        question.explanation = document.getElementById('questionExplanation').value.trim();
        
        // Сохраняем ответы
        question.answers = [];
        question.correctAnswers = [];
        
        const answerInputs = document.querySelectorAll('.answer-item');
        answerInputs.forEach((item, index) => {
            const text = item.querySelector('.answer-text').value.trim();
            const isCorrect = item.querySelector('input[type="checkbox"], input[type="radio"]').checked;
            
            if (text) {
                question.answers.push({ id: index, text: text });
                if (isCorrect) {
                    question.correctAnswers.push(index);
                }
            }
        });
        
        // Проверяем валидность
        if (question.answers.length < 2) {
            alert('Нужно минимум 2 варианта ответа');
            return;
        }
        
        if (question.type === 'single' && question.correctAnswers.length !== 1) {
            alert('Выберите один правильный ответ');
            return;
        }
        
        // Обновляем навигацию
        this.updateNavigationDots();
        
        // Переходим к следующему вопросу
        if (this.currentQuestionIndex < this.currentTest.questionsCount - 1) {
            this.nextQuestion();
        }
    }
    
    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.renderQuestion();
        }
    }
    
    nextQuestion() {
        if (this.currentQuestionIndex < this.currentTest.questionsCount - 1) {
            this.currentQuestionIndex++;
            this.renderQuestion();
        }
    }
    
    goToQuestion(index) {
        this.currentQuestionIndex = index;
        this.renderQuestion();
    }
    
    addAnswerOption() {
        if (this.currentTest && this.currentTest.answersCount < 6) {
            this.currentTest.answersCount++;
            this.renderQuestion();
        }
    }
    
    removeAnswerOption() {
        if (this.currentTest && this.currentTest.answersCount > 2) {
            this.currentTest.answersCount--;
            this.renderQuestion();
        }
    }
    
    backToSetup() {
        if (confirm('Вернуться к настройкам? Несохраненные данные будут потеряны.')) {
            document.getElementById('questionsEditor').style.display = 'none';
            document.getElementById('testSetupCard').style.display = 'block';
            this.currentTest = null;
        }
    }
    
    finishTest() {
        // Сохраняем тест
        this.saveTest();
        
        // Сбрасываем форму
        this.currentTest = null;
        document.getElementById('questionsEditor').style.display = 'none';
        document.getElementById('testSetupCard').style.display = 'block';
        
        alert('Тест успешно создан!');
    }
    
    saveTest() {
        const myTests = JSON.parse(localStorage.getItem('myTests') || '[]');
        myTests.push(this.currentTest);
        localStorage.setItem('myTests', JSON.stringify(myTests));
        
        this.loadMyTests();
    }
    
    loadMyTests() {
        const myTestsList = document.getElementById('myTestsList');
        if (!myTestsList) return;
        
        const myTests = JSON.parse(localStorage.getItem('myTests') || '[]');
        const userId = localStorage.getItem('userId') || 'anonymous';
        
        // Фильтруем тесты текущего пользователя
        const userTests = myTests.filter(test => test.creatorId === userId);
        
        if (userTests.length === 0) {
            myTestsList.innerHTML = '<p>У вас пока нет созданных тестов</p>';
            return;
        }
        
        myTestsList.innerHTML = userTests.map(test => `
            <div class="test-item">
                <h4>${test.title}</h4>
                <p>${test.description || 'Без описания'}</p>
                <div class="test-meta">
                    <span>${test.questionsCount} вопросов</span> • 
                    <span>${test.timeLimit ? test.timeLimit + ' мин' : 'Без времени'}</span>
                </div>
                <div class="test-actions">
                    <button class="btn-small btn-secondary" onclick="testCreator.editTest(${test.id})">
                        Редактировать
                    </button>
                    <button class="btn-small btn-primary" onclick="testCreator.startTest(${test.id})">
                        Начать тест
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    editTest(testId) {
        const myTests = JSON.parse(localStorage.getItem('myTests') || '[]');
        const test = myTests.find(t => t.id === testId);
        
        if (test) {
            this.currentTest = test;
            this.currentQuestionIndex = 0;
            
            // Заполняем форму
            document.getElementById('testTitle').value = test.title;
            document.getElementById('testDescription').value = test.description || '';
            document.getElementById('questionsCount').value = test.questionsCount;
            document.getElementById('answersCount').value = test.answersCount;
            document.getElementById('testTime').value = test.timeLimit || 30;
            
            document.getElementById('testSetupCard').style.display = 'none';
            document.getElementById('questionsEditor').style.display = 'block';
            document.getElementById('currentTestTitle').textContent = test.title;
            
            this.renderQuestion();
        }
    }
    
    startTest(testId) {
        localStorage.setItem('currentTestId', testId);
        window.location.href = '../Test/Test.html';
    }
}

// Создаем глобальный экземпляр
const testCreator = new TestCreator();