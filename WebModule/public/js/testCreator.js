// // testCreator.js - упрощенная версия для текущей структуры
// class TestCreator {
//     constructor() {
//         this.currentTest = null;
//         this.currentQuestionIndex = 0;
//         this.init();
//     }
    
//     init() {
//         // Назначаем обработчики после загрузки DOM
//         document.addEventListener('DOMContentLoaded', () => {
//             if (document.getElementById('setupContinueBtn')) {
//                 document.getElementById('setupContinueBtn').addEventListener('click', () => this.startQuestionsCreation());
//                 document.getElementById('backToSetupBtn').addEventListener('click', () => this.backToSetup());
//                 document.getElementById('addAnswerBtn').addEventListener('click', () => this.addAnswerOption());
//                 document.getElementById('removeAnswerBtn').addEventListener('click', () => this.removeAnswerOption());
//                 document.getElementById('saveQuestionBtn').addEventListener('click', () => this.saveQuestion());
//                 document.getElementById('finishTestBtn').addEventListener('click', () => this.finishTest());
//                 document.getElementById('prevQuestionBtn').addEventListener('click', () => this.prevQuestion());
//                 document.getElementById('nextQuestionBtn').addEventListener('click', () => this.nextQuestion());
                
//                 this.loadMyTests();
//             }
//         });
//     }
    
//     startQuestionsCreation() {
//         const testTitle = document.getElementById('testTitle').value.trim();
//         const questionsCount = parseInt(document.getElementById('questionsCount').value) || 5;
        
//         if (!testTitle) {
//             alert('Введите название теста');
//             return;
//         }
        
//         this.currentTest = {
//             id: Date.now(),
//             title: testTitle,
//             description: document.getElementById('testDescription').value.trim(),
//             questionsCount: questionsCount,
//             answersCount: parseInt(document.getElementById('answersCount').value) || 4,
//             timeLimit: parseInt(document.getElementById('testTime').value) || 0,
//             createdAt: new Date().toLocaleString(),
//             creatorId: localStorage.getItem('userId') || 'anonymous',
//             questions: []
//         };
        
//         // Создаем пустые вопросы
//         for (let i = 0; i < questionsCount; i++) {
//             this.currentTest.questions.push({
//                 id: i + 1,
//                 text: '',
//                 type: 'single',
//                 answers: [],
//                 correctAnswers: [],
//                 explanation: ''
//             });
//         }
        
//         this.currentQuestionIndex = 0;
        
//         // Переключаемся на создание вопросов
//         document.getElementById('testSetupCard').style.display = 'none';
//         document.getElementById('questionsEditor').style.display = 'block';
//         document.getElementById('currentTestTitle').textContent = testTitle;
        
//         this.renderQuestion();
//     }
    
//     renderQuestion() {
//         if (!this.currentTest) return;
        
//         const question = this.currentTest.questions[this.currentQuestionIndex];
//         const answersCount = this.currentTest.answersCount;
        
//         // Обновляем UI
//         document.getElementById('currentQuestionNumber').textContent = this.currentQuestionIndex + 1;
//         document.getElementById('questionsProgress').textContent = 
//             `Вопрос ${this.currentQuestionIndex + 1} из ${this.currentTest.questionsCount}`;
        
//         document.getElementById('questionText').value = question.text || '';
//         document.getElementById('questionExplanation').value = question.explanation || '';
        
//         // Тип вопроса
//         const typeRadios = document.getElementsByName('questionType');
//         typeRadios.forEach(radio => {
//             radio.checked = radio.value === question.type;
//         });
        
//         // Очищаем и создаем ответы
//         const answersContainer = document.getElementById('answersContainer');
//         answersContainer.innerHTML = '<h5>Варианты ответов (отметьте правильные):</h5>';
        
//         for (let i = 0; i < answersCount; i++) {
//             const answerDiv = document.createElement('div');
//             answerDiv.className = 'answer-item';
            
//             const inputType = question.type === 'multiple' ? 'checkbox' : 'radio';
//             const answerText = question.answers[i] ? question.answers[i].text : '';
//             const isCorrect = question.correctAnswers.includes(i);
            
//             answerDiv.innerHTML = `
//                 <input type="${inputType}" name="answer${this.currentQuestionIndex}" 
//                        ${isCorrect ? 'checked' : ''} data-index="${i}">
//                 <input type="text" class="answer-text" placeholder="Вариант ответа ${i + 1}"
//                        value="${answerText}" data-index="${i}">
//             `;
            
//             answersContainer.appendChild(answerDiv);
//         }
        
//         // Обновляем навигацию
//         this.updateNavigationDots();
//     }
    
//     updateNavigationDots() {
//         const dotsContainer = document.getElementById('questionDots');
//         dotsContainer.innerHTML = '';
        
//         for (let i = 0; i < this.currentTest.questionsCount; i++) {
//             const dot = document.createElement('div');
//             dot.className = 'question-dot';
//             dot.dataset.index = i;
            
//             if (i === this.currentQuestionIndex) {
//                 dot.classList.add('active');
//             }
            
//             if (this.currentTest.questions[i].text) {
//                 dot.classList.add('saved');
//             }
            
//             dot.addEventListener('click', () => this.goToQuestion(i));
//             dotsContainer.appendChild(dot);
//         }
        
//         // Кнопки навигации
//         document.getElementById('prevQuestionBtn').disabled = this.currentQuestionIndex === 0;
//         document.getElementById('nextQuestionBtn').disabled = 
//             this.currentQuestionIndex === this.currentTest.questionsCount - 1;
//     }
    
//     saveQuestion() {
//         const question = this.currentTest.questions[this.currentQuestionIndex];
//         const questionText = document.getElementById('questionText').value.trim();
        
//         if (!questionText) {
//             alert('Введите текст вопроса');
//             return;
//         }
        
//         // Сохраняем вопрос
//         question.text = questionText;
//         question.type = document.querySelector('input[name="questionType"]:checked').value;
//         question.explanation = document.getElementById('questionExplanation').value.trim();
        
//         // Сохраняем ответы
//         question.answers = [];
//         question.correctAnswers = [];
        
//         const answerInputs = document.querySelectorAll('.answer-item');
//         answerInputs.forEach((item, index) => {
//             const text = item.querySelector('.answer-text').value.trim();
//             const isCorrect = item.querySelector('input[type="checkbox"], input[type="radio"]').checked;
            
//             if (text) {
//                 question.answers.push({ id: index, text: text });
//                 if (isCorrect) {
//                     question.correctAnswers.push(index);
//                 }
//             }
//         });
        
//         // Проверяем валидность
//         if (question.answers.length < 2) {
//             alert('Нужно минимум 2 варианта ответа');
//             return;
//         }
        
//         if (question.type === 'single' && question.correctAnswers.length !== 1) {
//             alert('Выберите один правильный ответ');
//             return;
//         }
        
//         // Обновляем навигацию
//         this.updateNavigationDots();
        
//         // Переходим к следующему вопросу
//         if (this.currentQuestionIndex < this.currentTest.questionsCount - 1) {
//             this.nextQuestion();
//         }
//     }
    
//     prevQuestion() {
//         if (this.currentQuestionIndex > 0) {
//             this.currentQuestionIndex--;
//             this.renderQuestion();
//         }
//     }
    
//     nextQuestion() {
//         if (this.currentQuestionIndex < this.currentTest.questionsCount - 1) {
//             this.currentQuestionIndex++;
//             this.renderQuestion();
//         }
//     }
    
//     goToQuestion(index) {
//         this.currentQuestionIndex = index;
//         this.renderQuestion();
//     }
    
//     addAnswerOption() {
//         if (this.currentTest && this.currentTest.answersCount < 6) {
//             this.currentTest.answersCount++;
//             this.renderQuestion();
//         }
//     }
    
//     removeAnswerOption() {
//         if (this.currentTest && this.currentTest.answersCount > 2) {
//             this.currentTest.answersCount--;
//             this.renderQuestion();
//         }
//     }
    
//     backToSetup() {
//         if (confirm('Вернуться к настройкам? Несохраненные данные будут потеряны.')) {
//             document.getElementById('questionsEditor').style.display = 'none';
//             document.getElementById('testSetupCard').style.display = 'block';
//             this.currentTest = null;
//         }
//     }
    
//     finishTest() {
//         // Сохраняем тест
//         this.saveTest();
        
//         // Сбрасываем форму
//         this.currentTest = null;
//         document.getElementById('questionsEditor').style.display = 'none';
//         document.getElementById('testSetupCard').style.display = 'block';
        
//         alert('Тест успешно создан!');
//     }
    
//     saveTest() {
//         const myTests = JSON.parse(localStorage.getItem('myTests') || '[]');
//         myTests.push(this.currentTest);
//         localStorage.setItem('myTests', JSON.stringify(myTests));
        
//         this.loadMyTests();
//     }
    
//     loadMyTests() {
//         const myTestsList = document.getElementById('myTestsList');
//         if (!myTestsList) return;
        
//         const myTests = JSON.parse(localStorage.getItem('myTests') || '[]');
//         const userId = localStorage.getItem('userId') || 'anonymous';
        
//         // Фильтруем тесты текущего пользователя
//         const userTests = myTests.filter(test => test.creatorId === userId);
        
//         if (userTests.length === 0) {
//             myTestsList.innerHTML = '<p>У вас пока нет созданных тестов</p>';
//             return;
//         }
        
//         myTestsList.innerHTML = userTests.map(test => `
//             <div class="test-item">
//                 <h4>${test.title}</h4>
//                 <p>${test.description || 'Без описания'}</p>
//                 <div class="test-meta">
//                     <span>${test.questionsCount} вопросов</span> • 
//                     <span>${test.timeLimit ? test.timeLimit + ' мин' : 'Без времени'}</span>
//                 </div>
//                 <div class="test-actions">
//                     <button class="btn-small btn-secondary" onclick="testCreator.editTest(${test.id})">
//                         Редактировать
//                     </button>
//                     <button class="btn-small btn-primary" onclick="testCreator.startTest(${test.id})">
//                         Начать тест
//                     </button>
//                 </div>
//             </div>
//         `).join('');
//     }
    
//     editTest(testId) {
//         const myTests = JSON.parse(localStorage.getItem('myTests') || '[]');
//         const test = myTests.find(t => t.id === testId);
        
//         if (test) {
//             this.currentTest = test;
//             this.currentQuestionIndex = 0;
            
//             // Заполняем форму
//             document.getElementById('testTitle').value = test.title;
//             document.getElementById('testDescription').value = test.description || '';
//             document.getElementById('questionsCount').value = test.questionsCount;
//             document.getElementById('answersCount').value = test.answersCount;
//             document.getElementById('testTime').value = test.timeLimit || 30;
            
//             document.getElementById('testSetupCard').style.display = 'none';
//             document.getElementById('questionsEditor').style.display = 'block';
//             document.getElementById('currentTestTitle').textContent = test.title;
            
//             this.renderQuestion();
//         }
//     }
    
//     startTest(testId) {
//         localStorage.setItem('currentTestId', testId);
//         window.location.href = '../Test/Test.html';
//     }
// }

// // Создаем глобальный экземпляр
// const testCreator = new TestCreator();


// testCreator.js - обновленная версия с поддержкой структуры testQuestions
class TestCreator {
    constructor() {
        this.currentTest = null;
        this.currentQuestionIndex = 0;
        this.init();
    }
    
    init() {
        // Назначаем обработчики после загрузки DOM
        document.addEventListener('DOMContentLoaded', () => {
            console.log('TestCreator инициализирован');
            
            // Инициализируем элементы
            this.initElements();
            this.loadMyTests();
        });
    }
    
    initElements() {
        // Назначаем обработчики для элементов
        const setupBtn = document.getElementById('setupContinueBtn');
        if (setupBtn) {
            setupBtn.addEventListener('click', () => this.startQuestionsCreation());
        }
        
        const backBtn = document.getElementById('backToSetupBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.backToSetup());
        }
        
        const addAnswerBtn = document.getElementById('addAnswerBtn');
        if (addAnswerBtn) {
            addAnswerBtn.addEventListener('click', () => this.addAnswerOption());
        }
        
        const removeAnswerBtn = document.getElementById('removeAnswerBtn');
        if (removeAnswerBtn) {
            removeAnswerBtn.addEventListener('click', () => this.removeAnswerOption());
        }
        
        const saveQuestionBtn = document.getElementById('saveQuestionBtn');
        if (saveQuestionBtn) {
            saveQuestionBtn.addEventListener('click', () => this.saveQuestion());
        }
        
        const finishTestBtn = document.getElementById('finishTestBtn');
        if (finishTestBtn) {
            finishTestBtn.addEventListener('click', () => this.finishTest());
        }
        
        const prevQuestionBtn = document.getElementById('prevQuestionBtn');
        if (prevQuestionBtn) {
            prevQuestionBtn.addEventListener('click', () => this.prevQuestion());
        }
        
        const nextQuestionBtn = document.getElementById('nextQuestionBtn');
        if (nextQuestionBtn) {
            nextQuestionBtn.addEventListener('click', () => this.nextQuestion());
        }
        
        // Обработчики изменения типа вопроса
        const typeRadios = document.querySelectorAll('input[name="questionType"]');
        typeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.onQuestionTypeChange());
        });
    }
    
    startQuestionsCreation() {
        console.log('=== Начало создания теста ===');
        
        const testTitle = document.getElementById('testTitle').value.trim();
        const questionsCount = parseInt(document.getElementById('questionsCount').value) || 5;
        
        if (!testTitle) {
            alert('Введите название теста');
            return;
        }
        
        console.log(`Создание теста: "${testTitle}"`);
        console.log(`Количество вопросов: ${questionsCount}`);
        
        this.currentTest = {
            id: Date.now(),
            title: testTitle,
            description: document.getElementById('testDescription').value.trim(),
            questionsCount: questionsCount,
            answersCount: parseInt(document.getElementById('answersCount').value) || 4,
            timeLimit: parseInt(document.getElementById('testTime').value) || 0,
            createdAt: new Date().toLocaleString(),
            creatorId: localStorage.getItem('userId') || 'anonymous',
            creatorName: localStorage.getItem('username') || 'Аноним',
            questions: []
        };
        
        // Создаем пустые вопросы в структуре testQuestions
        for (let i = 0; i < questionsCount; i++) {
            this.currentTest.questions.push({
                id: i + 1,
                question: '',
                answers: Array(this.currentTest.answersCount).fill(''),
                correctAnswer: '', // Для типа "single"
                correctAnswers: [], // Для типа "multiple"
                explanation: '',
                type: 'single' // По умолчанию один правильный ответ
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
        
        console.log(`Отображение вопроса ${this.currentQuestionIndex + 1}`);
        
        // Обновляем UI
        document.getElementById('currentQuestionNumber').textContent = this.currentQuestionIndex + 1;
        document.getElementById('questionsProgress').textContent = 
            `Вопрос ${this.currentQuestionIndex + 1} из ${this.currentTest.questionsCount}`;
        
        // Заполняем данные вопроса
        document.getElementById('questionText').value = question.question || '';
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
            const answerText = question.answers[i] || '';
            
            // Проверяем, является ли ответ правильным
            let isCorrect = false;
            if (question.type === 'single') {
                isCorrect = question.correctAnswer === question.answers[i];
            } else if (question.type === 'multiple') {
                isCorrect = question.correctAnswers.includes(question.answers[i]);
            }
            
            answerDiv.innerHTML = `
                <input type="${inputType}" name="correctAnswer${this.currentQuestionIndex}" 
                       ${isCorrect ? 'checked' : ''} data-index="${i}">
                <input type="text" class="answer-text" placeholder="Вариант ответа ${i + 1}"
                       value="${answerText}" data-index="${i}">
            `;
            
            answersContainer.appendChild(answerDiv);
        }
        
        // Обновляем навигацию
        this.updateNavigationDots();
    }
    
    onQuestionTypeChange() {
        if (!this.currentTest) return;
        
        const selectedType = document.querySelector('input[name="questionType"]:checked').value;
        this.currentTest.questions[this.currentQuestionIndex].type = selectedType;
        
        // Перерисовываем ответы с новым типом
        this.renderQuestion();
    }
    
    updateNavigationDots() {
        const dotsContainer = document.getElementById('questionDots');
        if (!dotsContainer) return;
        
        dotsContainer.innerHTML = '';
        
        for (let i = 0; i < this.currentTest.questionsCount; i++) {
            const dot = document.createElement('div');
            dot.className = 'question-dot';
            dot.dataset.index = i;
            
            if (i === this.currentQuestionIndex) {
                dot.classList.add('active');
            }
            
            // Отмечаем сохраненные вопросы
            if (this.currentTest.questions[i].question) {
                dot.classList.add('saved');
            }
            
            dot.addEventListener('click', () => this.goToQuestion(i));
            dotsContainer.appendChild(dot);
        }
        
        // Кнопки навигации
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentQuestionIndex === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentQuestionIndex === this.currentTest.questionsCount - 1;
        }
    }
    
    saveQuestion() {
        if (!this.currentTest) return;
        
        console.log(`Сохранение вопроса ${this.currentQuestionIndex + 1}`);
        
        const question = this.currentTest.questions[this.currentQuestionIndex];
        const questionText = document.getElementById('questionText').value.trim();
        
        if (!questionText) {
            alert('Введите текст вопроса');
            return;
        }
        
        // Сохраняем вопрос
        question.question = questionText;
        question.type = document.querySelector('input[name="questionType"]:checked').value;
        question.explanation = document.getElementById('questionExplanation').value.trim();
        
        // Сохраняем ответы
        const answerInputs = document.querySelectorAll('.answer-item');
        const answers = [];
        const correctAnswers = [];
        
        answerInputs.forEach((item, index) => {
            const textInput = item.querySelector('.answer-text');
            const correctInput = item.querySelector('input[type="checkbox"], input[type="radio"]');
            
            const text = textInput.value.trim();
            const isCorrect = correctInput.checked;
            
            if (text) {
                answers.push(text);
                if (isCorrect) {
                    if (question.type === 'single') {
                        question.correctAnswer = text;
                    } else if (question.type === 'multiple') {
                        correctAnswers.push(text);
                    }
                }
            }
        });
        
        // Обновляем массивы
        question.answers = answers;
        if (question.type === 'multiple') {
            question.correctAnswers = correctAnswers;
        }
        
        // Проверяем валидность
        if (answers.length < 2) {
            alert('Нужно минимум 2 варианта ответа');
            return;
        }
        
        if (question.type === 'single' && !question.correctAnswer) {
            alert('Выберите один правильный ответ');
            return;
        }
        
        if (question.type === 'multiple' && correctAnswers.length === 0) {
            alert('Выберите хотя бы один правильный ответ');
            return;
        }
        
        console.log(`Вопрос сохранен: ${questionText.substring(0, 50)}...`);
        console.log(`Варианты ответов: ${answers.length}`);
        console.log(`Правильные ответы: ${question.type === 'single' ? question.correctAnswer : correctAnswers.length}`);
        
        // Обновляем навигацию
        this.updateNavigationDots();
        
        // Переходим к следующему вопросу, если он есть
        if (this.currentQuestionIndex < this.currentTest.questionsCount - 1) {
            this.nextQuestion();
        } else {
            alert('Все вопросы сохранены! Можете завершить создание теста.');
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
            
            // Обновляем все вопросы
            this.currentTest.questions.forEach(q => {
                if (q.answers.length < this.currentTest.answersCount) {
                    q.answers.push('');
                }
            });
            
            this.renderQuestion();
        }
    }
    
    removeAnswerOption() {
        if (this.currentTest && this.currentTest.answersCount > 2) {
            this.currentTest.answersCount--;
            
            // Обновляем все вопросы
            this.currentTest.questions.forEach(q => {
                if (q.answers.length > this.currentTest.answersCount) {
                    q.answers.pop();
                }
            });
            
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
        console.log('=== Завершение создания теста ===');
        
        // Проверяем, все ли вопросы заполнены
        const incompleteQuestions = this.currentTest.questions.filter(q => !q.question);
        if (incompleteQuestions.length > 0) {
            alert(`У вас есть незаполненные вопросы (${incompleteQuestions.length}). Заполните все вопросы перед завершением.`);
            return;
        }
        
        // Сохраняем тест
        this.saveTest();
        
        // Выводим структуру testQuestions в консоль
        console.log('=== Структура созданного теста (testQuestions format) ===');
        const testQuestionsFormat = this.currentTest.questions.map(q => {
            return {
                question: q.question,
                answers: q.answers,
                correctAnswer: q.type === 'single' ? q.correctAnswer : q.correctAnswers,
                explanation: q.explanation,
                type: q.type
            };
        });
        
        console.log('const testQuestions = ' + JSON.stringify(testQuestionsFormat, null, 2) + ';');
        
        // Копируем в буфер обмена
        const textToCopy = `const testQuestions = ${JSON.stringify(testQuestionsFormat, null, 2)};`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            console.log('Структура теста скопирована в буфер обмена');
        });
        
        alert(`Тест "${this.currentTest.title}" успешно создан!\n\nСтруктура теста выведена в консоль и скопирована в буфер обмена.\n\nКоличество вопросов: ${this.currentTest.questionsCount}\nВариантов ответов: ${this.currentTest.answersCount}\nВремя на выполнение: ${this.currentTest.timeLimit || 'без ограничения'} мин`);
        
        // Сбрасываем форму
        this.currentTest = null;
        document.getElementById('questionsEditor').style.display = 'none';
        document.getElementById('testSetupCard').style.display = 'block';
        
        // Очищаем форму
        document.getElementById('testTitle').value = '';
        document.getElementById('testDescription').value = '';
        document.getElementById('questionsCount').value = '5';
        document.getElementById('answersCount').value = '4';
        document.getElementById('testTime').value = '30';
        
        // Обновляем список тестов
        this.loadMyTests();
    }
    
    saveTest() {
        console.log('Сохранение теста в localStorage');
        
        const myTests = JSON.parse(localStorage.getItem('myTests') || '[]');
        myTests.push(this.currentTest);
        localStorage.setItem('myTests', JSON.stringify(myTests));
        
        console.log(`Тест сохранен. Всего тестов: ${myTests.length}`);
        
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
        
        console.log(`Загружено тестов пользователя: ${userTests.length}`);
        
        myTestsList.innerHTML = userTests.map(test => `
            <div class="test-item" style="
                background: white;
                padding: 15px;
                margin-bottom: 15px;
                border-radius: 8px;
                border: 1px solid #ddd;
            ">
                <h4 style="margin: 0 0 10px 0;">${test.title}</h4>
                <p style="margin: 0 0 10px 0; color: #666;">${test.description || 'Без описания'}</p>
                <div class="test-meta" style="font-size: 14px; color: #888; margin-bottom: 10px;">
                    <span>${test.questionsCount} вопросов</span> • 
                    <span>${test.answersCount} вариантов ответа</span> • 
                    <span>${test.timeLimit ? test.timeLimit + ' мин' : 'Без времени'}</span> •
                    <span>Создан: ${test.createdAt}</span>
                </div>
                <div class="test-actions">
                    <button class="btn-small btn-secondary" onclick="testCreator.editTest(${test.id})" style="
                        padding: 5px 10px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-right: 5px;
                    ">
                        Редактировать
                    </button>
                    <button class="btn-small btn-primary" onclick="testCreator.viewTestStructure(${test.id})" style="
                        padding: 5px 10px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">
                        Посмотреть структуру
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    editTest(testId) {
        console.log(`Редактирование теста ID: ${testId}`);
        
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
            document.getElementById('currentTestTitle').textContent = test.title + ' (редактирование)';
            
            this.renderQuestion();
        }
    }
    
    viewTestStructure(testId) {
        console.log(`Просмотр структуры теста ID: ${testId}`);
        
        const myTests = JSON.parse(localStorage.getItem('myTests') || '[]');
        const test = myTests.find(t => t.id === testId);
        
        if (test) {
            // Конвертируем в формат testQuestions
            const testQuestionsFormat = test.questions.map(q => {
                return {
                    question: q.question,
                    answers: q.answers,
                    correctAnswer: q.type === 'single' ? q.correctAnswer : q.correctAnswers,
                    explanation: q.explanation,
                    type: q.type
                };
            });
            
            const structureText = `const testQuestions = ${JSON.stringify(testQuestionsFormat, null, 2)};`;
            
            // Показываем в alert
            alert(`Структура теста "${test.title}":\n\n${structureText}\n\nСтруктура также выведена в консоль.`);
            
            console.log(`=== Структура теста "${test.title}" ===`);
            console.log(structureText);
            
            // Копируем в буфер обмена
            navigator.clipboard.writeText(structureText).then(() => {
                console.log('Структура теста скопирована в буфер обмена');
                alert('Структура теста скопирована в буфер обмена!');
            });
        }
    }
}

// Создаем глобальный экземпляр
const testCreator = new TestCreator();
window.testCreator = testCreator;