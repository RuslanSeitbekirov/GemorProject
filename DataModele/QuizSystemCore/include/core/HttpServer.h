#pragma once
#include <memory>
#include <string>
#include <functional>
#include <cpprest/http_listener.h>
#include <cpprest/json.h>
#include <spdlog/spdlog.h>

namespace QuizSystem::Core {
    
class HttpServer {
public:
    HttpServer(const std::string& host = "0.0.0.0", int port = 8080);
    ~HttpServer();
    
    bool start();
    void stop();
    bool isRunning() const;
    
    // Регистрация обработчиков
    void handleGet(const std::string& path, 
                  std::function<void(web::http::http_request)> handler);
    void handlePost(const std::string& path, 
                   std::function<void(web::http::http_request)> handler);
    void handlePut(const std::string& path, 
                  std::function<void(web::http::http_request)> handler);
    void handleDelete(const std::string& path, 
                     std::function<void(web::http::http_request)> handler);
    
private:
    void setupRoutes();
    void logRequest(const web::http::http_request& req);
    
    // Обработчики для каждого пути
    void handleRoot(web::http::http_request req);
    void handleHealth(web::http::http_request req);
    void handleDocs(web::http::http_request req);
    void handleQuizzes(web::http::http_request req);
    void handleNotFound(web::http::http_request req);
    
private:
    std::string m_host;
    int m_port;
    std::atomic<bool> m_isRunning;
    std::shared_ptr<spdlog::logger> m_logger;
    web::http::experimental::listener::http_listener m_listener;
};

} // namespace QuizSystem::Core