#pragma once
#include <memory>

namespace QuizSystem::Core {
    class DatabaseManager {
    public:
        DatabaseManager();
        ~DatabaseManager();
        
        bool connect();
        void disconnect();
        bool isConnected() const;
        
    private:
        class Impl;
        std::unique_ptr<Impl> m_impl;
    };
}