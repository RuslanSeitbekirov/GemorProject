#ifndef USERCONTROLLER_H
#define USERCONTROLLER_H

#include "api/BaseController.h"
#include "services/UserService.h"
#include <memory>

namespace QuizSystem {
namespace Api {

class UserController : public BaseController {
public:
    UserController(std::shared_ptr<Services::UserService> userService);
    virtual ~UserController() = default;
    
    // Регистрация обработчиков
    void registerHandlers() override;
    
private:
    // Обработчики запросов
    void handleGetUsers(http_request request);
    void handleGetUserById(http_request request);
    void handleCreateUser(http_request request);
    void handleUpdateUser(http_request request);
    void handleDeleteUser(http_request request);
    void handleGetUserRoles(http_request request);
    void handleAddUserRole(http_request request);
    void handleRemoveUserRole(http_request request);
    void handleSearchUsers(http_request request);
    
    // Авторизация (заглушка для примера)
    bool isAuthorized(const http_request& request, int targetUserId = 0);
    bool isAdmin(const http_request& request);
    
private:
    std::shared_ptr<Services::UserService> m_userService;
};

} // namespace Api
} // namespace QuizSystem

#endif // USERCONTROLLER_H