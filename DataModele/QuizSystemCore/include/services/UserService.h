#ifndef USERSERVICE_H
#define USERSERVICE_H

#include <memory>
#include <string>
#include <vector>
#include <optional>
#include "models/User.h"
#include "repositories/UserRepository.h"
#include "utils/Logger.h"

namespace QuizSystem {
namespace Services {

class UserService {
public:
    // Конструктор с внедрением зависимостей
    UserService(std::shared_ptr<Repositories::UserRepository> repository);
    virtual ~UserService() = default;
    
    // Регистрация нового пользователя
    std::optional<Models::User> registerUser(const std::string& email,
                                            const std::string& password,
                                            const std::string& fullName,
                                            const std::vector<Models::UserRole>& roles = {});
    
    // Аутентификация пользователя
    std::optional<Models::User> authenticate(const std::string& email,
                                            const std::string& password);
    
    // Получение пользователя по ID
    std::optional<Models::User> getUserById(int id);
    
    // Получение пользователя по email
    std::optional<Models::User> getUserByEmail(const std::string& email);
    
    // Получение всех пользователей
    std::vector<Models::User> getAllUsers(int page = 1, int pageSize = 20);
    
    // Обновление пользователя
    bool updateUser(int userId, const Models::User& updatedUser);
    
    // Удаление пользователя
    bool deleteUser(int userId, bool softDelete = true);
    
    // Смена пароля
    bool changePassword(int userId, const std::string& oldPassword,
                       const std::string& newPassword);
    
    // Сброс пароля (администратором)
    bool resetPassword(int userId, const std::string& newPassword);
    
    // Управление ролями
    bool assignRole(int userId, Models::UserRole role);
    bool revokeRole(int userId, Models::UserRole role);
    std::vector<Models::UserRole> getUserRoles(int userId);
    
    // Поиск пользователей
    std::vector<Models::User> searchUsers(const std::string& query, int limit = 50);
    
    // Валидация данных пользователя
    static bool validateUserData(const Models::User& user);
    static bool validateEmail(const std::string& email);
    static bool validatePassword(const std::string& password);
    
    // Генерация JWT токена (заглушка для примера)
    std::string generateToken(const Models::User& user) const;
    
private:
    std::shared_ptr<Repositories::UserRepository> m_repository;
    std::shared_ptr<spdlog::logger> m_logger;
    
    // Генерация соли для пароля
    std::string generateSalt() const;
    
    // Хеширование пароля с солью
    std::string hashPassword(const std::string& password, const std::string& salt) const;
    
    // Проверка пароля
    bool verifyPassword(const std::string& password,
                       const std::string& hash,
                       const std::string& salt) const;
};

} // namespace Services
} // namespace QuizSystem

#endif // USERSERVICE_H