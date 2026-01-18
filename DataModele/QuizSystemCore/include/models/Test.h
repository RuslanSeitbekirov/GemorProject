#ifndef TEST_H
#define TEST_H

#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <nlohmann/json.hpp>
#include "Question.h"
namespace QuizSystem {
namespace Models {

// Класс теста
class Test {
public:
    // Конструкторы
    Test();
    Test(int id, const std::string& title, const std::string& description, int createdBy);
    
    // Геттеры
    int getId() const { return m_id; }
    const std::string& getTitle() const { return m_title; }
    const std::string& getDescription() const { return m_description; }
    int getCreatedBy() const { return m_createdBy; }
    const std::chrono::system_clock::time_point& getCreatedAt() const { return m_createdAt; }
    const std::chrono::system_clock::time_point& getUpdatedAt() const { return m_updatedAt; }
    bool isPublished() const { return m_isPublished; }
    int getTimeLimitMinutes() const { return m_timeLimitMinutes; }
    const std::vector<std::shared_ptr<Question>>& getQuestions() const { return m_questions; }
    
    // Сеттеры
    void setId(int id) { m_id = id; }
    void setTitle(const std::string& title) { m_title = title; }
    void setDescription(const std::string& description) { m_description = description; }
    void setCreatedBy(int createdBy) { m_createdBy = createdBy; }
    void setCreatedAt(const std::chrono::system_clock::time_point& createdAt) { m_createdAt = createdAt; }
    void setUpdatedAt(const std::chrono::system_clock::time_point& updatedAt) { m_updatedAt = updatedAt; }
    void setIsPublished(bool isPublished) { m_isPublished = isPublished; }
    void setTimeLimitMinutes(int minutes) { m_timeLimitMinutes = minutes; }
    
    // Методы для работы с вопросами
    void addQuestion(std::shared_ptr<Question> question);
    void removeQuestion(int questionId);
    std::shared_ptr<Question> getQuestion(int questionId) const;
    void clearQuestions() { m_questions.clear(); }
    size_t getQuestionCount() const { return m_questions.size(); }
    
    // Расчет общего количества баллов
    int getTotalPoints() const;
    
    // Валидация
    bool isValid() const;
    
    // Сериализация/десериализация JSON
    nlohmann::json toJson(bool includeQuestions = true) const;
    static Test fromJson(const nlohmann::json& json);
    
private:
    int m_id;
    std::string m_title;
    std::string m_description;
    int m_createdBy;
    std::chrono::system_clock::time_point m_createdAt;
    std::chrono::system_clock::time_point m_updatedAt;
    bool m_isPublished;
    int m_timeLimitMinutes;
    std::vector<std::shared_ptr<Question>> m_questions;
};

} // namespace Models
} // namespace QuizSystem

#endif // TEST_H