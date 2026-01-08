// testCreator.js - обновленная версия с работой через API
class TestCreator {
    constructor() {
        this.API_BASE = 'http://localhost:3000/api';
        this.currentTest = null;
        this.currentQuestionIndex = 0;
        this.init();
    }
    
    async init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initElements();
            this.loadMyTests();
        });
    }
    
    // ... (остальные методы остаются похожими, но добавляем API вызовы)
    
    async saveTestToServer() {
        const accessToken = localStorage.getItem('accessToken');
        
        if (!accessToken) {
            alert('Требуется авторизация');
            window.location.href = 'Registration.html';
            return;
        }
        
        const testQuestionsFormat = this.currentTest.questions.map(q => ({
            question: q.question,
            answers: q.answers.filter(a => a), // Убираем пустые ответы
            correctAnswer: q.type === 'single' ? q.correctAnswer : q.correctAnswers,
            explanation: q.explanation,
            type: q.type
        }));
        
        const testData = {
            test_name: this.currentTest.title,
            description: this.currentTest.description,
            time_limit: this.currentTest.timeLimit,
            test_data: {
                questions: testQuestionsFormat,
                timeLimit: this.currentTest.timeLimit * 60, // в секундах
                createdAt: new Date().toISOString()
            }
        };
        
        try {
            const response = await fetch(`${this.API_BASE}/tests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(testData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Сохраняем также в localStorage для быстрого доступа
                this.saveToLocalStorage(result.testId, result.createdAt);
                return true;
            } else {
                alert('Ошибка сохранения теста');
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
            // Показываем тесты из localStorage как fallback
            this.loadFromLocalStorage();
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
                    <button class="action-btn btn-edit" onclick="testCreator.editTest(${JSON.stringify(test).replace(/"/g, '&quot;')})">
                        Редактировать
                    </button>
                    <button class="action-btn btn-delete" onclick="testCreator.deleteTest(${test.id})">
                        Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    async deleteTest(testId) {
        if (!confirm('Вы уверены, что хотите удалить этот тест?')) return;
        
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
                alert('Ошибка удаления теста');
            }
        } catch (error) {
            console.error('Delete test error:', error);
            alert('Ошибка сети при удалении теста');
        }
    }
    
    // ... остальные методы
}

const testCreator = new TestCreator();
window.testCreator = testCreator;