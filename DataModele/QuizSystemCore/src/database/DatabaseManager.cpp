#include "database/DatabaseManager.h"
#include <iostream>

namespace QuizSystem::Core {
    
    class DatabaseManager::Impl {
    public:
        bool connected = false;
    };
    
    DatabaseManager::DatabaseManager() 
        : m_impl(std::make_unique<Impl>()) {
        std::cout << "DatabaseManager created" << std::endl;
    }
    
    DatabaseManager::~DatabaseManager() = default;
    
    bool DatabaseManager::connect() {
        m_impl->connected = true;
        std::cout << "Database connected" << std::endl;
        return true;
    }
    
    void DatabaseManager::disconnect() {
        m_impl->connected = false;
        std::cout << "Database disconnected" << std::endl;
    }
    
    bool DatabaseManager::isConnected() const {
        return m_impl->connected;
    }
}