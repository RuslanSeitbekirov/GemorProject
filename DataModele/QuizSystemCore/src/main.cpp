#include <iostream>
#include <cpprest/http_listener.h>
#include <cpprest/json.h>

using namespace web;
using namespace web::http;
using namespace web::http::experimental::listener;

void handle_request(http_request request) {
    // Простой вывод без преобразования методов
    std::cout << "📡 Получен HTTP запрос" << std::endl;
    
    // Простой JSON ответ
    json::value response;
    response[U("message")] = json::value::string(U("Hello from Quiz System!"));
    response[U("status")] = json::value::string(U("OK"));
    
    request.reply(status_codes::OK, response);
}

int main() {
    std::cout << "🚀 Запуск Quiz System Core..." << std::endl;
    
    try {
        http_listener listener(U("http://localhost:8080"));
        
        // Обрабатываем только GET запросы для простоты
        listener.support(methods::GET, handle_request);
        
        listener.open().wait();
        std::cout << "✅ Сервер запущен: http://localhost:8080" << std::endl;
        std::cout << "⏸️  Нажмите Enter для остановки..." << std::endl;
        
        std::cin.get();
        
        listener.close().wait();
        std::cout << "👋 Сервер остановлен" << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Ошибка: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}