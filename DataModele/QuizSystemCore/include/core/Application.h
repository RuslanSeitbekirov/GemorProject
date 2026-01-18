#ifndef APPLICATION_H
#define APPLICATION_H

#include <memory>
#include <string>
#include <atomic>

namespace QuizSystem {
namespace Core {

class DatabaseManager;
class HttpServer;

class Application {
public:
    Application();
    ~Application();
    
    // Удаляем копирование и присваивание
    Application(const Application&) = delete;
    Application& operator=(const Application&) = delete;
    
    // Инициализация приложения
    bool initialize();
    
    // Запуск приложения
    void start();
    
    // Остановка приложения
    void stop();
    
    // Проверка работы приложения
    bool isRunning() const;
    
private:
    // Инициализация базы данных
    bool initializeDatabase();
    
    // Инициализация HTTP сервера
    bool initializeHttpServer();
    
    // Регистрация API endpoints
    void registerApiEndpoints();
    
private:
    std::atomic<bool> m_isRunning;
    std::unique_ptr<DatabaseManager> m_databaseManager;
    std::unique_ptr<HttpServer> m_httpServer;
};

} // namespace Core
} // namespace QuizSystem

#endif // APPLICATION_H