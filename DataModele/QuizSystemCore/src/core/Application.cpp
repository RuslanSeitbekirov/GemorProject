#include "core/Application.h"
#include "core/HttpServer.h"
#include <iostream>
#include <memory>

namespace QuizSystem::Core {

Application::Application() 
    : m_isRunning(false)
    , m_httpServer(nullptr) {  // ✅ Инициализируем nullptr
    std::cout << "Application created" << std::endl;
}

Application::~Application() {
    stop();  // ✅ Добавляем деструктор
    std::cout << "Application destroyed" << std::endl;
}

bool Application::initialize() {
    std::cout << "Application initializing..." << std::endl;
    
    try {
        // Инициализация HTTP сервера
        m_httpServer = std::make_unique<HttpServer>("localhost", 18081);
        
        std::cout << "✅ Application initialized successfully" << std::endl;
        return true;
    } catch (const std::exception& e) {
        std::cerr << "❌ Failed to initialize application: " << e.what() << std::endl;
        return false;
    }
}

void Application::start() {
    if (m_isRunning) {
        std::cout << "Application already running" << std::endl;
        return;
    }
    
    std::cout << "Application starting..." << std::endl;
    
    try {
        // Запуск HTTP сервера
        if (m_httpServer && m_httpServer->start()) {
            m_isRunning = true;
            std::cout << "✅ Application started successfully" << std::endl;
            std::cout << "🌐 Server running at: http://localhost:18081" << std::endl;
        } else {
            std::cerr << "❌ Failed to start HTTP server" << std::endl;
            m_isRunning = false;
        }
    } catch (const std::exception& e) {
        std::cerr << "❌ Exception during start: " << e.what() << std::endl;
        m_isRunning = false;
    }
}

void Application::stop() {
    if (!m_isRunning) return;
    
    std::cout << "Stopping application..." << std::endl;
    
    if (m_httpServer) {
        m_httpServer->stop();
    }
    
    m_isRunning = false;
    std::cout << "Application stopped" << std::endl;
}

bool Application::isRunning() const {
    return m_isRunning;
}

} // namespace QuizSystem::Core