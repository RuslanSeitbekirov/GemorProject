#ifndef QUESTION_H
#define QUESTION_H

#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <nlohmann/json.hpp>
#include "AnswerOption.h"

namespace QuizSystem {
namespace Models {

// Типы вопросов
enum class QuestionType {
    SingleChoice = 1,    // Один правильный ответ
    MultipleChoice = 2,  // Несколько правильных ответов
    TextAnswer = 3,      // Текстовый ответ
    TrueFalse = 4        // Верно/Неверно
};

// Конвертация типа вопроса в строку
inline std::string questionTypeToString(QuestionType type) {
    switch (type) {
        case QuestionType::SingleChoice: return "single_choice";
        case QuestionType::MultipleChoice: return "multiple_choice";
        case QuestionType::TextAnswer: return "text_answer";
        case QuestionType::TrueFalse: return "true_false";
        default: return "unknown";
    }
}

// Конвертация строки в тип вопроса
inline QuestionType stringToQuestionType(const std::string& typeStr) {
    if (typeStr == "single_choice") return QuestionType::SingleChoice;
    if (typeStr == "multiple_choice") return QuestionType::MultipleChoice;
    if (typeStr == "text_answer") return QuestionType::TextAnswer;
    if (typeStr == "true_false") return QuestionType::TrueFalse;
    throw std::invalid_argument("Unknown question type: " + typeStr);
}

// Класс вопроса
class Question {
public:
    // Конструкторы
    Question();
    Question(int id, int testId, const std::string& questionText, QuestionType type, int points);
    
    // Геттеры
    int getId() const { return m_id; }
    int getTestId() const { return m_testId; }
    const std::string& getQuestionText() const { return m_questionText; }
    QuestionType getType() const { return m_type; }
    int getPoints() const { return m_points; }
    int getSortOrder() const { return m_sortOrder; }
    const std::chrono::system_clock::time_point& getCreatedAt() const { return m_createdAt; }
    const std::vector<std::shared_ptr<AnswerOption>>& getAnswerOptions() const { return m_answerOptions; }
    
    // Сеттеры
    void setId(int id) { m_id = id; }
    void setTestId(int testId) { m_testId = testId; }
    void setQuestionText(const std::string& questionText) { m_questionText = questionText; }
    void setType(QuestionType type) { m_type = type; }
    void setPoints(int points) { m_points = points; }
    void setSortOrder(int sortOrder) { m_sortOrder = sortOrder; }
    void setCreatedAt(const std::chrono::system_clock::time_point& createdAt) { m_createdAt = createdAt; }
    
    // Методы для работы с вариантами ответов
    void addAnswerOption(std::shared_ptr<AnswerOption> option);
    void removeAnswerOption(int optionId);
    std::shared_ptr<AnswerOption> getAnswerOption(int optionId) const;
    void clearAnswerOptions() { m_answerOptions.clear(); }
    size_t getAnswerOptionCount() const { return m_answerOptions.size(); }
    
    // Проверка ответа (для автоматической проверки)
    bool checkAnswer(const nlohmann::json& userAnswer) const;
    
    // Валидация
    bool isValid() const;
    
    // Сериализация/десериализация JSON
    nlohmann::json toJson(bool includeAnswerOptions = true, bool includeCorrectAnswers = false) const;
    static Question fromJson(const nlohmann::json& json);
    
private:
    int m_id;
    int m_testId;
    std::string m_questionText;
    QuestionType m_type;
    int m_points;
    int m_sortOrder;
    std::chrono::system_clock::time_point m_createdAt;
    std::vector<std::shared_ptr<AnswerOption>> m_answerOptions;
};

} // namespace Models
} // namespace QuizSystem

#endif // QUESTION_H