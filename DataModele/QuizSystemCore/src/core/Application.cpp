// src/core/Application.cpp
#include "Core/Application.h"
#include "Core/HttpServer.h"  // Убедитесь, что этот include есть
#include "Database/DatabaseManager.h" 
#include <iostream>

namespace QuizSystem::Core {
    
    Application::Application() 
        : m_httpServer(std::make_unique<HttpServer>()) {
        std::cout << "Application created" << std::endl;
    }
    
    Application::~Application() {
        std::cout << "Application destroyed" << std::endl;
    }
    
    bool Application::initialize() {
        std::cout << "Application initialized" << std::endl;
        return m_httpServer->start();
    }
    
    void Application::start() {
        std::cout << "Application started" << std::endl;
    }
    
    void Application::stop() {
        m_httpServer->stop();
        std::cout << "Application stopped" << std::endl;
    }
    
    bool Application::isRunning() const {
        return m_httpServer->isRunning();
    }
}