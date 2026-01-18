#ifndef USERREPOSITORY_H
#define USERREPOSITORY_H

#include "repositories/BaseRepository.h"
#include "models/User.h"
#include <memory>
#include <vector>
#include <optional>

namespace QuizSystem {
namespace Repositories {

class UserRepository : public BaseRepository {
public:
    UserRepository();
    virtual ~UserRepository() = default;
    
    // CRUD операции
    std::optional<Models::User> findById(int id);
    std::optional<Models::User> findByEmail(const std::string& email);
    std::vector<Models::User> findAll(int limit = 100, int offset = 0);
    std::vector<Models::User> findByRole(Models::UserRole role);
    
    bool create(Models::User& user);
    bool update(const Models::User& user);
    bool remove(int id);
    bool softDelete(int id); // Мягкое удаление (is_active = false)
    
    // Проверка пароля
    bool verifyPassword(int userId, const std::string& password);
    
    // Обновление пароля
    bool updatePassword(int userId, const std::string& newPasswordHash);
    
    // Управление ролями
    bool addUserRole(int userId, Models::UserRole role);
    bool removeUserRole(int userId, Models::UserRole role);
    std::vector<Models::UserRole> getUserRoles(int userId);
    
    // Поиск
    std::vector<Models::User> search(const std::string& query, int limit = 50);
    
    // Статистика
    int countAll();
    int countActive();
    int countByRole(Models::UserRole role);
    
private:
    // Маппинг результата запроса в объект User
    Models::User mapResultToUser(PGresult* res, int row);
    
    // Маппинг ролей для пользователя
    std::vector<Models::UserRole> getUserRolesFromDb(int userId);
    
    // Хеширование пароля
    std::string hashPassword(const std::string& password) const;
    
    // Проверка существования email
    bool emailExists(const std::string& email, int excludeUserId = 0);
};

} // namespace Repositories
} // namespace QuizSystem

#endif // USERREPOSITORY_H