#ifndef BASECONTROLLER_H
#define BASECONTROLLER_H

#include <cpprest/http_listener.h>
#include <cpprest/json.h>
#include <memory>
#include <spdlog/spdlog.h>
#include "utils/ConfigLoader.h"

namespace QuizSystem {
namespace Api {

using namespace web;
using namespace web::http;
using namespace web::http::experimental::listener;

class BaseController {
public:
    BaseController(const std::string& basePath);
    virtual ~BaseController();
    
    // Регистрация обработчиков
    virtual void registerHandlers() = 0;
    
    // Получение пути контроллера
    const std::string& getBasePath() const { return m_basePath; }
    
protected:
    // Утилиты для работы с HTTP
    static json::value parseRequestBody(http_request& request);
    static std::map<std::string, std::string> parseQueryParams(const uri& uri);
    static std::string getPathParam(const http_request& request, const std::string& name);
    
    // Отправка ответов
    static void sendResponse(http_request& request,
                            status_code status,
                            const json::value& body);
    
    static void sendError(http_request& request,
                         status_code status,
                         const std::string& message);
    
    static void sendSuccess(http_request& request,
                          const json::value& data = json::value::object());
    
    static void sendCreated(http_request& request,
                           const json::value& data = json::value::object());
    
    static void sendNoContent(http_request& request);
    
    static void sendBadRequest(http_request& request,
                              const std::string& message);
    
    static void sendUnauthorized(http_request& request,
                                const std::string& message = "Unauthorized");
    
    static void sendForbidden(http_request& request,
                             const std::string& message = "Forbidden");
    
    static void sendNotFound(http_request& request,
                            const std::string& message = "Resource not found");
    
    static void sendInternalError(http_request& request,
                                 const std::string& message = "Internal server error");
    
    // Валидация
    static bool validateRequiredFields(const json::value& data,
                                      const std::vector<std::string>& requiredFields,
                                      std::string& errorMessage);
    
    // Пагинация
    static std::pair<int, int> parsePaginationParams(const http_request& request,
                                                    int defaultPage = 1,
                                                    int defaultPageSize = 20);
    
protected:
    std::string m_basePath;
    std::shared_ptr<spdlog::logger> m_logger;
};

} // namespace Api
} // namespace QuizSystem

#endif // BASECONTROLLER_H