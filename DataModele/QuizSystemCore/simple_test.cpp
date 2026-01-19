#include <iostream>
#include <cpprest/http_listener.h>
#include <cpprest/json.h>

using namespace web;
using namespace web::http;
using namespace web::http::experimental::listener;

int main() {
    std::cout << "🚀 ЗАПУСК ТЕСТОВОГО СЕРВЕРА\n";
    
    // 1. Создаем listener
    http_listener listener(U("http://localhost:8080"));
    
    // 2. Обработчик всех запросов
    listener.support([](http_request req) {
        auto path = req.relative_uri().path();
        
        std::cout << "Запрос: " << utility::conversions::to_utf8string(path) << std::endl;
        
        if (path == U("/") || path == U("")) {
            json::value response;
            response[U("message")] = json::value(U("Hello World!"));
            response[U("status")] = json::value(U("OK"));
            req.reply(status_codes::OK, response);
        }
        else if (path == U("/api/test")) {
            json::value response;
            response[U("test")] = json::value(U("success"));
            req.reply(status_codes::OK, response);
        }
        else {
            req.reply(status_codes::NotFound);
        }
    });
    
    try {
        // 3. Запускаем
        listener.open().wait();
        std::cout << "✅ Сервер запущен!\n";
        std::cout << "🌐 Открой http://localhost:8080\n";
        std::cout << "📡 Или http://localhost:8080/api/test\n";
        std::cout << "\nНажми Enter для остановки...\n";
        
        // 4. Ждем Enter
        std::cin.get();
        
        // 5. Останавливаем
        listener.close().wait();
        std::cout << "👋 Сервер остановлен\n";
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Ошибка: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}