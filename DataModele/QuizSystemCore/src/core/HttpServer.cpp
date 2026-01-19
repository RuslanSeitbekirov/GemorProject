#include "core/HttpServer.h"
#include <iostream>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <spdlog/sinks/stdout_color_sinks.h>

using namespace web;
using namespace web::http;
using namespace web::http::experimental::listener;

namespace QuizSystem::Core {
    
HttpServer::HttpServer(const std::string& host, int port) 
    : m_host(host), m_port(port), m_isRunning(false) {
    
    // Создаём URI для listener
    utility::string_t address = U("http://") + 
                               utility::conversions::to_string_t(host) + 
                               U(":") + 
                               std::to_wstring(port);
    
    m_listener = http_listener(address);
    
    // Создаём логгер для HTTP сервера
    m_logger = spdlog::get("http");
    if (!m_logger) {
        m_logger = spdlog::stdout_color_mt("http");
        m_logger->set_level(spdlog::level::info);
    }
    
    m_logger->info("HTTP сервер создан на {}:{}", host, port);
}

HttpServer::~HttpServer() {
    stop();
}

bool HttpServer::start() {
    if (m_isRunning) {
        m_logger->warn("HTTP сервер уже запущен");
        return true;
    }
    
    try {
        setupRoutes(); // Устанавливаем маршруты ПЕРЕД открытием
        m_listener.open().wait();
        m_isRunning = true;
        m_logger->info("✅ HTTP сервер запущен на http://{}:{}", m_host, m_port);
        return true;
        
    } catch (const std::exception& e) {
        m_logger->error("❌ Ошибка запуска HTTP сервера: {}", e.what());
        return false;
    }
}

void HttpServer::stop() {
    if (!m_isRunning) return;
    
    m_logger->info("🛑 Остановка HTTP сервера...");
    m_isRunning = false;
    
    try {
        m_listener.close().wait();
        m_logger->info("✅ HTTP сервер остановлен");
    } catch (const std::exception& e) {
        m_logger->error("Ошибка при остановке: {}", e.what());
    }
}

bool HttpServer::isRunning() const {
    return m_isRunning;
}

void HttpServer::handleGet(const std::string& path, 
                          std::function<void(http_request)> handler) {
    // В этой версии не используем
    m_logger->info("Зарегистрирован GET {}", path);
}

// Остальные handle-методы пустые
void HttpServer::handlePost(const std::string& path, 
                           std::function<void(http_request)> handler) {}
void HttpServer::handlePut(const std::string& path, 
                          std::function<void(http_request)> handler) {}
void HttpServer::handleDelete(const std::string& path, 
                             std::function<void(http_request)> handler) {}

void HttpServer::setupRoutes() {
    // Устанавливаем ОДИН обработчик для всех запросов
    m_listener.support([this](http_request req) {
        logRequest(req);
        
        auto path = utility::conversions::to_utf8string(req.relative_uri().path());
        auto method = utility::conversions::to_utf8string(req.method());
        
        // 1. Корневой путь /
        if ((path == "/" || path.empty()) && method == "GET") {
            auto now = std::chrono::system_clock::now();
            auto time = std::chrono::system_clock::to_time_t(now);
            std::stringstream ss;
            ss << std::put_time(std::localtime(&time), "%Y-%m-%d %H:%M:%S");
            
            json::value response;
            response[U("service")] = json::value(U("Quiz System API"));
            response[U("version")] = json::value(U("1.0.0"));
            response[U("status")] = json::value(U("running"));
            response[U("timestamp")] = json::value(utility::conversions::to_string_t(ss.str()));
            
            json::value endpoints = json::value::array();
            endpoints[0] = json::value(U("/api/health"));
            endpoints[1] = json::value(U("/api/docs"));
            endpoints[2] = json::value(U("/api/quizzes"));
            response[U("endpoints")] = endpoints;
            
            req.reply(status_codes::OK, response);
        }
        // 2. Health check
        else if (path == "/api/health" && method == "GET") {
            json::value response;
            response[U("status")] = json::value(U("healthy"));
            response[U("timestamp")] = json::value(
                std::chrono::duration_cast<std::chrono::seconds>(
                    std::chrono::system_clock::now().time_since_epoch()
                ).count());
            
            req.reply(status_codes::OK, response);
        }
        // 3. API документация
        else if (path == "/api/docs" && method == "GET") {
            json::value response;
            response[U("openapi")] = json::value(U("3.0.0"));
            
            json::value info;
            info[U("title")] = json::value(U("Quiz System API"));
            info[U("version")] = json::value(U("1.0.0"));
            info[U("description")] = json::value(U("API для системы тестирования и викторин"));
            response[U("info")] = info;
            
            req.reply(status_codes::OK, response);
        }
        // 4. Викторины
        else if (path == "/api/quizzes" && method == "GET") {
            json::value response = json::value::array();
            
            // Тестовая викторина 1
            json::value quiz1;
            quiz1[U("id")] = json::value(1);
            quiz1[U("title")] = json::value(U("Основы C++"));
            quiz1[U("description")] = json::value(U("Тест по основам языка C++"));
            quiz1[U("questions_count")] = json::value(10);
            quiz1[U("difficulty")] = json::value(U("beginner"));
            response[0] = quiz1;
            
            // Тестовая викторина 2
            json::value quiz2;
            quiz2[U("id")] = json::value(2);
            quiz2[U("title")] = json::value(U("Стандартная библиотека C++"));
            quiz2[U("description")] = json::value(U("Тест по STL и стандартной библиотеке"));
            quiz2[U("questions_count")] = json::value(15);
            quiz2[U("difficulty")] = json::value(U("intermediate"));
            response[1] = quiz2;
            
            req.reply(status_codes::OK, response);
        }
        // 5. 404 Not Found
        else {
            m_logger->warn("404 Not Found: {} {}", method, path);
            
            json::value response;
            response[U("error")] = json::value(U("Not Found"));
            response[U("path")] = json::value(utility::conversions::to_string_t(path));
            response[U("timestamp")] = json::value(
                std::chrono::duration_cast<std::chrono::seconds>(
                    std::chrono::system_clock::now().time_since_epoch()
                ).count());
            
            req.reply(status_codes::NotFound, response);
        }
    });
    
    m_logger->info("Маршруты настроены");
}

void HttpServer::logRequest(const web::http::http_request& req) {
    if (m_logger) {
        m_logger->info("{} {} {}", 
            utility::conversions::to_utf8string(req.method()),
            utility::conversions::to_utf8string(req.relative_uri().to_string()),
            utility::conversions::to_utf8string(req.remote_address()));
    }
}

} // namespace QuizSystem::Core