#ifndef APPLICATION_H
#define APPLICATION_H

#include <memory>
#include <string>
#include <atomic>

namespace QuizSystem {
namespace Core {

class DatabaseManager; // Только объявление, если не используется
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
    std::atomic<bool> m_isRunning;
    std::unique_ptr<HttpServer> m_httpServer;
    // Убрал DatabaseManager если он не используется
};

} // namespace Core
} // namespace QuizSystem

#endif // APPLICATION_H