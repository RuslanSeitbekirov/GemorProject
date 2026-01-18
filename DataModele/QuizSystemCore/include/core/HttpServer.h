#pragma once
#include <memory>

namespace QuizSystem::Core {
    class HttpServer {
    public:
        HttpServer();
        ~HttpServer();
        
        bool start();
        void stop();
        bool isRunning() const;
        
    private:
        class Impl;
        std::unique_ptr<Impl> m_impl;
    };
}