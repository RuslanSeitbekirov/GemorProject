#ifndef USER_H
#define USER_H

#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <nlohmann/json.hpp>

namespace QuizSystem {
namespace Models {

// Перечисление ролей пользователя
enum class UserRole {
    Admin = 1,
    Teacher = 2,
    Student = 3
};

// Конвертация роли в строку
inline std::string userRoleToString(UserRole role) {
    switch (role) {
        case UserRole::Admin: return "admin";
        case UserRole::Teacher: return "teacher";
        case UserRole::Student: return "student";
        default: return "unknown";
    }
}

// Конвертация строки в роль
inline UserRole stringToUserRole(const std::string& roleStr) {
    if (roleStr == "admin") return UserRole::Admin;
    if (roleStr == "teacher") return UserRole::Teacher;
    if (roleStr == "student") return UserRole::Student;
    throw std::invalid_argument("Unknown user role: " + roleStr);
}

// Класс пользователя
class User {
public:
    // Конструкторы
    User();
    User(int id, const std::string& email, const std::string& fullName);
    
    // Геттеры
    int getId() const { return m_id; }
    const std::string& getEmail() const { return m_email; }
    const std::string& getFullName() const { return m_fullName; }
    const std::string& getPasswordHash() const { return m_passwordHash; }
    const std::chrono::system_clock::time_point& getCreatedAt() const { return m_createdAt; }
    const std::chrono::system_clock::time_point& getUpdatedAt() const { return m_updatedAt; }
    bool isActive() const { return m_isActive; }
    const std::vector<UserRole>& getRoles() const { return m_roles; }
    
    // Сеттеры
    void setId(int id) { m_id = id; }
    void setEmail(const std::string& email) { m_email = email; }
    void setFullName(const std::string& fullName) { m_fullName = fullName; }
    void setPasswordHash(const std::string& passwordHash) { m_passwordHash = passwordHash; }
    void setCreatedAt(const std::chrono::system_clock::time_point& createdAt) { m_createdAt = createdAt; }
    void setUpdatedAt(const std::chrono::system_clock::time_point& updatedAt) { m_updatedAt = updatedAt; }
    void setIsActive(bool isActive) { m_isActive = isActive; }
    
    // Методы для работы с ролями
    void addRole(UserRole role);
    void removeRole(UserRole role);
    bool hasRole(UserRole role) const;
    void clearRoles() { m_roles.clear(); }
    
    // Валидация
    bool isValid() const;
    
    // Сериализация/десериализация JSON
    nlohmann::json toJson() const;
    static User fromJson(const nlohmann::json& json);
    
    // Сравнение
    bool operator==(const User& other) const;
    bool operator!=(const User& other) const { return !(*this == other); }
    
private:
    int m_id;
    std::string m_email;
    std::string m_fullName;
    std::string m_passwordHash;
    std::chrono::system_clock::time_point m_createdAt;
    std::chrono::system_clock::time_point m_updatedAt;
    bool m_isActive;
    std::vector<UserRole> m_roles;
};

} // namespace Models
} // namespace QuizSystem

#endif // USER_H