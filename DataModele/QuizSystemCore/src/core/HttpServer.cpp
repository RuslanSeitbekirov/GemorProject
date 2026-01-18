#include "Core/HttpServer.h"

namespace QuizSystem::Core {
    
    class HttpServer::Impl {
    public:
        bool running = false;
    };
    
    HttpServer::HttpServer() : m_impl(std::make_unique<Impl>()) {}
    HttpServer::~HttpServer() = default;
    
    bool HttpServer::start() { 
        m_impl->running = true;
        return true; 
    }
    
    void HttpServer::stop() { 
        m_impl->running = false; 
    }
    
    bool HttpServer::isRunning() const { 
        return m_impl->running; 
    }
}