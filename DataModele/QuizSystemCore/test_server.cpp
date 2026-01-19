#include <cpprest/http_listener.h>
#include <cpprest/json.h>
#include <iostream>

using namespace web;
using namespace web::http;
using namespace web::http::experimental::listener;

int main() {
    try {
        std::string host = "localhost";
        int port = 18081;
        utility::string_t address = U("http://") + 
                                   utility::conversions::to_string_t(host) + 
                                   U(":") + 
                                   std::to_wstring(port);
        
        std::cout << "Попытка запуска сервера на: " << utility::conversions::to_utf8string(address) << std::endl;
        
        http_listener listener(address);
        
        listener.support(methods::GET, [](http_request req) {
            std::cout << "Получен GET запрос" << std::endl;
            json::value response;
            response[U("message")] = json::value(U("Hello from test server!"));
            req.reply(status_codes::OK, response);
        });
        
        listener.open().wait();
        std::cout << "✅ Сервер запущен! Нажмите Enter для остановки..." << std::endl;
        
        std::cin.get();
        
        listener.close().wait();
        std::cout << "Сервер остановлен" << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Ошибка: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}