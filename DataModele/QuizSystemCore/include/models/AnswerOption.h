#ifndef ANSWEROPTION_H
#define ANSWEROPTION_H

#include <string>
#include <nlohmann/json.hpp>

namespace QuizSystem {
namespace Models {

// Класс варианта ответа
class AnswerOption {
public:
    // Конструкторы
    AnswerOption();
    AnswerOption(int id, int questionId, const std::string& optionText, bool isCorrect);
    
    // Геттеры
    int getId() const { return m_id; }
    int getQuestionId() const { return m_questionId; }
    const std::string& getOptionText() const { return m_optionText; }
    bool isCorrect() const { return m_isCorrect; }
    int getSortOrder() const { return m_sortOrder; }
    
    // Сеттеры
    void setId(int id) { m_id = id; }
    void setQuestionId(int questionId) { m_questionId = questionId; }
    void setOptionText(const std::string& optionText) { m_optionText = optionText; }
    void setIsCorrect(bool isCorrect) { m_isCorrect = isCorrect; }
    void setSortOrder(int sortOrder) { m_sortOrder = sortOrder; }
    
    // Валидация
    bool isValid() const;
    
    // Сериализация/десериализация JSON
    nlohmann::json toJson(bool includeCorrectness = false) const;
    static AnswerOption fromJson(const nlohmann::json& json);
    
private:
    int m_id;
    int m_questionId;
    std::string m_optionText;
    bool m_isCorrect;
    int m_sortOrder;
};

} // namespace Models
} // namespace QuizSystem

#endif // ANSWEROPTION_H