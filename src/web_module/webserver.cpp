#include <iostream>
#include "crow.h"
#include <crow/middlewares/session.h>
#include <crow/middlewares/cookie_parser.h>
#include "crow/mustache.h"
#include "redis_client.hpp"
#include <filesystem>
#include <string>
#include <chrono>
#include <vector>
#include <random>
#include <string>
#include <array>

using namespace crow;
using namespace std;

using Session = crow::SessionMiddleware<crow::FileStore>; // читаем файл
namespace fs = std::filesystem;

const std::string AUTH_SERVER_URL = "http://auth-server:8080";
const std::string MAIN_MODULE_URL = "http://main-module:8081";
const int LOGIN_TOKEN_TTL = 300;      // 5 минут (ТЗ)
const int SESSION_TTL = 3600 * 24 * 7; // 7 дней (ТЗ)
const int ACCESS_TOKEN_TTL = 60;       // 1 минута (ТЗ для JWT)

class TokenGenerator {
private:
    static std::mt19937& get_rng() {
        static thread_local std::mt19937 rng(std::random_device{}());
        return rng;
    }
    
public:
    static std::string generate(size_t length = 32) {
        const char charset[] = 
            "0123456789"
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            "abcdefghijklmnopqrstuvwxyz";
        
        thread_local auto& rng = get_rng();
        std::uniform_int_distribution<size_t> dist(0, sizeof(charset) - 2);
        
        std::string token;
        token.reserve(length);
        
        for (size_t i = 0; i < length; ++i) {
            token.push_back(charset[dist(rng)]);
        }
        
        return token;
    }
    
    // URL-safe генерация
    static std::string generate_url_safe(size_t length = 32) {
        const char charset[] = 
            "0123456789"
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            "abcdefghijklmnopqrstuvwxyz";
        
        thread_local auto& rng = get_rng();
        std::uniform_int_distribution<size_t> dist(0, sizeof(charset) - 2);
        
        std::string token;
        token.reserve(length);
        
        for (size_t i = 0; i < length; ++i) {
            token.push_back(charset[dist(rng)]);
        }
        
        return token;
    }
    
    static std::string generate_session_token() { // сессионный токен
        return generate(64);
    }
    
    static std::string generate_login_token() { // токен входа
        return generate(32);
    }
};

struct SessionData {
    static constexpr const char* STATUS_UNKNOWN = "unknown";
    static constexpr const char* STATUS_ANONYMOUS = "anonymous";
    static constexpr const char* STATUS_AUTHORIZED = "authorized";
    
    string status;
    string login_token;
    string access_token;
    string refresh_token;
    string user_id;
    
    SessionData() : status(STATUS_UNKNOWN) {}
    
    static SessionData anonymous(const string& login_token = "") {
        SessionData session;
        session.status = STATUS_ANONYMOUS;
        session.login_token = login_token;
        return session;
    }
    
    static SessionData authorized(const string& access_token, 
                                  const string& refresh_token, 
                                  const string& user_id) {
        SessionData session;
        session.status = STATUS_AUTHORIZED;
        session.access_token = access_token;
        session.refresh_token = refresh_token;
        session.user_id = user_id;
        return session;
    }
    
    bool is_unknown() const { return status == STATUS_UNKNOWN; }
    bool is_anonymous() const { return status == STATUS_ANONYMOUS; }
    bool is_authorized() const { return status == STATUS_AUTHORIZED; }
    
    bool is_valid() const { // валидация
        if (status == STATUS_AUTHORIZED) { // autorized = оба токена, user_id
            return !access_token.empty() && 
                   !refresh_token.empty() && 
                   !user_id.empty();
        }
        if (status == STATUS_ANONYMOUS) {
            return !login_token.empty(); // anonimous = login_token
        }
        return status == STATUS_UNKNOWN;
    }
    
    bool has_jwt_tokens() const { // наличие jwt 
        return !access_token.empty() && !refresh_token.empty();
    }
    
    void clear() { // очистка, перевод в unknown
        status = STATUS_UNKNOWN;
        login_token.clear();
        access_token.clear();
        refresh_token.clear();
        user_id.clear();
    }
    
    string to_redis_string() const { // сериализация в Redis
        return status + "|" +  
               login_token + "|" + 
               access_token + "|" + 
               refresh_token + "|" + 
               user_id; // статус|login_token|access_token|refresh_token|user_id
    }
    
    static SessionData from_redis_string(const string& data) { // десериализация из Redis
        SessionData session;
        
        if (data.empty()) {
            return session; // пустая строка = unknown
        }
        
        size_t start = 0;
        size_t end = 0;
        int field_num = 0;
        
        while (end != string::npos && field_num < 5) {
            end = data.find('|', start);
            
            string field;
            if (end == string::npos) {
                field = data.substr(start);
            } else {
                field = data.substr(start, end - start);
            }
            
            switch (field_num) {
                case 0: session.status = field; break;
                case 1: session.login_token = field; break;
                case 2: session.access_token = field; break;
                case 3: session.refresh_token = field; break;
                case 4: session.user_id = field; break;
            }
            
            start = end + 1;
            field_num++;
        }
        
        if (!session.is_valid()) { // валидация после парсинга
            session.clear(); // после повреждения данных статус сессии
        }
        return session;
    }
    
    void authorize(const string& new_access_token, 
                   const string& new_refresh_token,
                   const string& new_user_id) { // анонимный - авторизованный
        if (status == STATUS_ANONYMOUS) {
            status = STATUS_AUTHORIZED;
            access_token = new_access_token;
            refresh_token = new_refresh_token;
            user_id = new_user_id;
            login_token.clear(); // не нужен по тз
        }
    }
    
    bool needs_token_refresh() const { // проверка истечения токенов
        return false;
    }
    
    string to_string() const { // отладка
        return "SessionData{status=" + status + 
               ", user_id=" + user_id + 
               ", has_jwt=" + (has_jwt_tokens() ? "true" : "false") + 
               "}";
    }
};

class SimpleHttpClient {
public:
    static std::string get(const std::string& url, int timeout_sec = 5) {
        // Заглушка для тестирования
        std::cout << "HTTP GET: " << url << std::endl;
        
        // Имитация разных ответов
        if (url.find("/auth?type=") != std::string::npos) {
            if (url.find("type=github") != std::string::npos) {
                return R"({"redirect_url": "https://github.com/login/oauth/authorize?client_id=test&state=xyz"})";
            } else if (url.find("type=yandex") != std::string::npos) {
                return R"({"redirect_url": "https://oauth.yandex.ru/authorize?client_id=test&state=xyz"})";
            } else if (url.find("type=code") != std::string::npos) {
                return R"({"code": "123456"})";
            }
        } else if (url.find("/auth/check") != std::string::npos) {
            return R"({"status": "не получен"})";
        }
        
        return "{}";
    }
    
    static std::string post_json(const std::string& url, 
                                const std::string& json_data, 
                                int timeout_sec = 5) {
        std::cout << "HTTP POST: " << url << " - " << json_data << std::endl;
        
        if (url.find("/auth/refresh") != std::string::npos) {
            return R"({"access_token": "new_access_token", "refresh_token": "new_refresh_token"})";
        } else if (url.find("/auth/logout") != std::string::npos) {
            return R"({"status": "ok"})";
        }
        
        return R"({"status": "success"})";
    }
};

bool check_anonymous_session(RedisClient& redis, SessionData& session, 
                            const std::string& session_token) {
    // Валидация входных данных
    if (!session.is_anonymous()) {
        // Не анонимный пользователь - нечего проверять
        return true;
    }
    
    // роверка обязательного поля по ТЗ
    if (session.login_token.empty()) {
        // Анонимный пользователь должен иметь login_token по ТЗ
        // Это ошибка состояния - очищаем сессию
        std::cerr << "ERROR: Anonymous session without login_token. Cleaning up." << std::endl;
        session.clear();
        redis.set("session:" + session_token, session.to_redis_string());
        return false; // Сессия очищена
    }
    
    // 3. Проверяем токен у сервера авторизации
    std::string check_url = "http://auth-server:8080/auth/check?token=" + session.login_token;
    
    try {
        std::string auth_response = SimpleHttpClient::get(check_url);
        
        if (auth_response.empty()) {
            std::cerr << "ERROR: Empty response from auth server" << std::endl;
            return false; // Не удалось проверить
        }
        
        // 4. Парсим JSON ответ
        auto json = crow::json::load(auth_response);
        if (!json) {
            std::cerr << "ERROR: Invalid JSON from auth server: " << auth_response << std::endl;
            return false;
        }
        
        // 5. Проверяем наличие поля статуса
        if (!json.has("status")) {
            std::cerr << "ERROR: No 'status' field in auth response" << std::endl;
            return false;
        }
        
        std::string status = json["status"].s();
        std::cout << "Auth check for token " << session.login_token.substr(0, 8) 
                  << "...: " << status << std::endl;
        
        // 6. Обработка по ТЗ
        if (status == "не опознанный токен" || status == "время действия токена закончилось") {
            // ТЗ: "Web Client делает запрос Redis, чтобы он удалил текущий ключ"
            std::cout << "  -> Deleting session (token invalid/expired)" << std::endl;
            session.clear(); // Важно: обновляем локальный объект
            redis.set("session:" + session_token, session.to_redis_string());
            return false; // Сессия удалена
        }
        
        if (status == "в доступе отказано") {
            // ТЗ: "Web Client делает запрос Redis, чтобы он удалил текущий ключ"
            std::cout << "  -> Deleting session (access denied)" << std::endl;
            session.clear(); // Важно: обновляем локальный объект
            redis.set("session:" + session_token, session.to_redis_string());
            return false; // Сессия удалена
        }
        
        if (status == "доступ предоставлен") {
            // ТЗ: "проверяет, что в ответе от модуля авторизации присутствуют 2 JWT токена"
            if (!json.has("access_token") || !json.has("refresh_token")) {
                std::cerr << "ERROR: No JWT tokens in auth response" << std::endl;
                return false;
            }
            
            // Получаем user_id (может быть в отдельном поле или извлекаться из токена)
            std::string user_id = "";
            if (json.has("user_id")) {
                user_id = json["user_id"].s();
            }
            
            // ТЗ: "меняет статус пользователя на Авторизованный"
            session.authorize(
                json["access_token"].s(),
                json["refresh_token"].s(),
                user_id
            );
            
            // ТЗ: "сохранить новый статус пользователя и оба JWT токена"
            redis.set("session:" + session_token, session.to_redis_string());
            
            std::cout << "  -> Session upgraded to AUTHORIZED" 
                      << (user_id.empty() ? "" : " for user: " + user_id) << std::endl;
            
            return true; // Успешная авторизация
        }
        
        // ТЗ: оставляем сессию как есть, продолжаем ждать
        std::cout << "  -> Auth still pending, keeping session" << std::endl;
        return true; // Сессия валидна, продолжаем ждать
        
    } catch (const std::exception& e) {
        std::cerr << "EXCEPTION in check_anonymous_session: " << e.what() << std::endl;
        return false;
    } catch (...) {
        std::cerr << "UNKNOWN EXCEPTION in check_anonymous_session" << std::endl;
        return false;
    }
}

// Исправленная функция проверки авторизации
std::pair<bool, SessionData> check_authorization(RedisClient& redis, 
                                                 crow::CookieParser::context& ctx,
                                                 crow::response& res) {
    auto session_cookie = ctx.get_cookie("session_token");
    
    if (session_cookie.empty()) {
        res.code = 401;
        crow::json::wvalue error;
        error["error"] = std::string("Unauthorized");
        error["message"] = std::string("No session token");
        res.write(error.dump()); 
        res.add_header("Content-Type", "application/json");
        return {false, SessionData()};
    }
    
    std::string redis_key = "session:" + session_cookie;
    std::string session_data;
    
    try {
        session_data = redis.get(redis_key);
    } catch (const std::exception& e) {
        std::cerr << "Redis error: " << e.what() << std::endl;
        res.code = 500;
        crow::json::wvalue error;
        error["error"] = std::string("Internal server error");
        error["message"] = std::string("Storage error");
        res.write(error.dump());
        res.add_header("Content-Type", "application/json");
        return {false, SessionData()};
    }
    
    if (session_data.empty()) {
        res.code = 401;
        crow::json::wvalue error;
        error["error"] = std::string("Session expired");
        error["message"] = std::string("Session not found in storage");
        res.write(error.dump());
        res.add_header("Content-Type", "application/json");
        return {false, SessionData()};
    }
    
    SessionData session = SessionData::from_redis_string(session_data);
    
    if (!session.is_authorized() || session.access_token.empty()) {
        res.code = 401;
        crow::json::wvalue error;
        error["error"] = std::string("Not authorized");
        error["message"] = std::string("User not authenticated");
        res.write(error.dump());
        res.add_header("Content-Type", "application/json");
        return {false, SessionData()};
    }
    
    return {true, session};
}

// Функция для запросов к главному модулю с обработкой обновления токена
crow::json::wvalue make_authorized_request(RedisClient& redis,
                                          SessionData& session,
                                          const std::string& session_token,
                                          const std::string& url,
                                          const std::string& method = "GET",
                                          const std::string& body = "") {
    // Временная заглушка
    crow::json::wvalue response;
    response["error"] = "Not implemented";
    response["message"] = "API proxy not implemented yet";
    return response;
}

int main(){
    RedisClient redis("","redis-web");
    redis.ping();

    // папка для сессий (если она еще не существует)
    if (!(fs::exists(fs::path("sessions")) && fs::exists(fs::path("sessions")))) {
        fs::create_directory(fs::path("sessions"));
    }

    crow::App<crow::CookieParser, Session> app{Session{
        crow::FileStore {"sessions"},
    }};

    // МАРШРУТЫ
    CROW_ROUTE(app, "/")([&app, &redis](const crow::request& req, crow::response& res) { // главная страница, по тз проверка статуса
    // получаем токен сессии из куки
    try {
        auto& ctx = app.get_context<crow::CookieParser>(req);
        auto session_cookie = ctx.get_cookie("session_token");
        
        std::cout << "GET / - session_cookie: " 
                  << (session_cookie.empty() ? "empty" : session_cookie.substr(0, 8) + "...") 
                  << std::endl;
        
        if (session_cookie.empty()) {
            // нет куки - страница входа
            std::cout << "Unknown user, showing index.html" << std::endl;
            res.set_static_file_info("templates/index.html");
        } else {
            // проверка сессии в redis
            std::string redis_key = "session:" + session_cookie;
            std::string session_data = redis.get(redis_key);
            
            std::cout << "Redis key: " << redis_key 
                      << ", data: " << (session_data.empty() ? "empty" : "found") 
                      << std::endl;
            
            if (session_data.empty()) {
                // сессии нет в Redis - неизвестный пользователь
                std::cout << "Session not in Redis, showing index.html" << std::endl;
                res.set_static_file_info("templates/index.html");
            } else {
                SessionData session = SessionData::from_redis_string(session_data);
                std::cout << "Session status: " << session.status << std::endl;
                
                if (session.is_authorized()) {
                    // АВТОРИЗОВАННЫЙ ПОЛЬЗОВАТЕЛЬ (личный кабинет)
                    std::cout << "Authorized, showing dashboard.html" << std::endl;
                    res.set_static_file_info("templates/dashboard.html");
                } else if (session.is_anonymous()) {
                    // АНОНИМНЫЙ ПОЛЬЗОВАТЕЛЬ (проверка токена входа)
                    std::cout << "Anonymous user with login_token" << std::endl;
                    // анонимный пользователь должен быть перенаправлен на проверку токена входа у Authorization Server, мы здесь показываем ту же страницу, но JS проверит статус
                    res.set_static_file_info("templates/index.html");
                } else {
                    // UNKNOWN статус
                    std::cout << "Unknown session status, showing index.html" << std::endl;
                    res.set_static_file_info("templates/index.html");
                }
            }
        }
        
        res.add_header("Content-Type", "text/html");
        res.end();
        
    } catch (const std::exception& e) {
        std::cerr << "Error in GET /: " << e.what() << std::endl;
        res.code = 500;
        res.write("Internal server error");
        res.end();
    }
});

CROW_ROUTE(app, "/login")
.methods("GET"_method)([&app, &redis](const crow::request& req, crow::response& res) {
    try {
        auto& ctx = app.get_context<crow::CookieParser>(req);
        auto session_cookie = ctx.get_cookie("session_token");
        
        std::cout << "GET /login - session_cookie: " 
                  << (session_cookie.empty() ? "empty" : session_cookie.substr(0, 8) + "...") 
                  << std::endl;
        
        // Проверяем тип авторизации
        auto type_param = req.url_params.get("type");
        
        if (!type_param) {
            // /login без параметров → редирект на главную (ТЗ)
            std::cout << "  -> No type parameter, redirecting to /" << std::endl;
            res.redirect("/");
            return;
        }
        
        std::string auth_type(type_param);
        std::cout << "  -> Auth type: " << auth_type << std::endl;
        
        // Валидация типа авторизации
        if (auth_type != "github" && auth_type != "yandex" && auth_type != "code") {
            std::cout << "  -> Invalid auth type, redirecting to /" << std::endl;
            res.redirect("/");
            return;
        }
        
        // Проверяем существующую сессию
        if (!session_cookie.empty()) {
            std::string existing_data = redis.get("session:" + session_cookie);
            if (!existing_data.empty()) {
                SessionData existing_session = SessionData::from_redis_string(existing_data);
                
                if (existing_session.is_authorized()) {
                    // ТЗ: уже авторизован → редирект на главную
                    std::cout << "  -> Already authorized, redirecting to /" << std::endl;
                    res.redirect("/");
                    return;
                }
                // Если анонимный - продолжим использовать эту сессию
            }
        }
        
        // Генерируем токены
        std::string session_token;
        std::string login_token = TokenGenerator::generate_login_token();
        
        std::cout << "  -> Generated login_token: " << login_token.substr(0, 8) << "..." << std::endl;
        
        if (session_cookie.empty()) {
            // НОВЫЙ ПОЛЬЗОВАТЕЛЬ (ТЗ: генерируем новый токен сессии)
            session_token = TokenGenerator::generate_session_token();
            std::cout << "  -> New user, generated session_token: " 
                      << session_token.substr(0, 8) << "..." << std::endl;
            
            // Устанавливаем куку
            ctx.set_cookie("session_token", session_token)
               .max_age(3600 * 24 * 7)  // 7 дней
               .path("/")
               .httponly();
        } else {
            // СУЩЕСТВУЮЩАЯ СЕССИЯ (используем текущий токен)
            session_token = session_cookie;
            std::cout << "  -> Existing session_token: " 
                      << session_token.substr(0, 8) << "..." << std::endl;
        }
        
        // Сохраняем/обновляем анонимную сессию в Redis (ТЗ: статус "anonymous")
        SessionData session = SessionData::anonymous(login_token);
        
        // ТЗ: 5 минут для токена входа
        std::string redis_key = "session:" + session_token;
        
        // Сохраняем в Redis - используем простой подход
        // Если set возвращает void, просто вызываем его
        redis.set(redis_key, session.to_redis_string());
        
        // Пытаемся установить TTL (5 минут = 300 секунд)
        // Если нет метода expire, попробуем setex или просто оставим без TTL
        // Проверяем доступные методы RedisClient
        
        std::cout << "  -> Saved anonymous session to Redis" << std::endl;
        
        // Формируем URL для авторизации (ТЗ: запрос к модулю Авторизации)
        std::string auth_url;
        std::string service_host = "auth-server"; // или из конфига
        
        if (auth_type == "github") {
            auth_url = "https://" + service_host + ":8080/auth?type=github&token=" + login_token;
        } else if (auth_type == "yandex") {
            auth_url = "https://" + service_host + ":8080/auth?type=yandex&token=" + login_token;
        }
        std::cout << "  -> Redirecting to: " << auth_url << std::endl;
        
        // РЕДИРЕКТ на сервер авторизации (ТЗ)
        res.redirect(auth_url);
        
    } catch (const std::exception& e) {
        std::cerr << "Error in /login: " << e.what() << std::endl;
        res.code = 500;
        res.write("Internal server error");
    }
});

CROW_ROUTE(app, "/auth/callback")
.methods("GET"_method)([&app, &redis](const crow::request& req, crow::response& res) {
    try {
        auto code_param = req.url_params.get("code");
        auto state_param = req.url_params.get("state");
        auto error_param = req.url_params.get("error");
        
        std::cout << "GET /auth/callback - state: " 
                  << (state_param ? state_param : "none") 
                  << ", code: " << (code_param ? "present" : "none")
                  << ", error: " << (error_param ? error_param : "none") 
                  << std::endl;
        
        if (!state_param) {
            std::cout << "  -> No state parameter" << std::endl;
            res.redirect("/");
            return;
        }
        
        std::string state(state_param);
        
        // ВАЖНО: Этот маршрут обычно не используется напрямую в нашей архитектуре
        // По ТЗ сервер авторизации сам обновляет статус login_token в своем словаре
        // Web Client периодически проверяет статус через /api/status
        
        // Однако, если сервер авторизации перенаправляет сюда с токенами:
        if (code_param) {
            // Код получен - успешная авторизация
            std::cout << "  -> OAuth code received, exchanging for tokens..." << std::endl;
            
            // TODO: Обменять код на токены через сервер авторизации
            // Это должен делать сервер авторизации, а не Web Client
            
            // Временное решение - редирект на главную
            res.redirect("/?auth=success");
        } 
        else if (error_param) {
            // Ошибка авторизации (пользователь отказался)
            std::cout << "  -> OAuth error: " << error_param << std::endl;
            
            // Найти и удалить сессию с этим login_token
            // Это сложно без индекса login_token->session_token
            
            res.redirect("/?auth=error");
        }
        else {
            // Неизвестное состояние
            std::cout << "  -> Unknown callback state" << std::endl;
            res.redirect("/");
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error in /auth/callback: " << e.what() << std::endl;
        res.redirect("/");
    }
});

// Обновленный маршрут /logout
CROW_ROUTE(app, "/logout")
.methods("GET"_method)([&app, &redis](const crow::request& req, crow::response& res) {
    try {
        auto& ctx = app.get_context<crow::CookieParser>(req);
        auto session_cookie = ctx.get_cookie("session_token");
        auto all_param = req.url_params.get("all");
        bool logout_all = (all_param && std::string(all_param) == "true");
        
        std::cout << "GET /logout - session_cookie: " 
                  << (session_cookie.empty() ? "empty" : session_cookie.substr(0, 8) + "...")
                  << ", all=" << (logout_all ? "true" : "false") 
                  << std::endl;
        
        if (!session_cookie.empty()) {
            std::string redis_key = "session:" + session_cookie;
            
            try {
                std::string session_data = redis.get(redis_key);
                
                if (!session_data.empty()) {
                    SessionData session = SessionData::from_redis_string(session_data);
                    
                    // Только авторизованные пользователи могут выйти со всех устройств
                    if (logout_all && session.is_authorized() && !session.refresh_token.empty()) {
                        // ВАЖНО: Сначала отправляем запрос на сервер авторизации
                        std::string logout_url = "http://auth-server:8080/auth/logout";
                        std::string post_data = R"({"refresh_token": ")" + session.refresh_token + R"("})";
                        
                        try {
                            SimpleHttpClient::post_json(logout_url, post_data);
                            std::cout << "  -> Sent logout request for all devices" << std::endl;
                        } catch (const std::exception& e) {
                            // Логируем ошибку, но продолжаем локальный logout
                            std::cerr << "  -> Failed to notify auth server: " << e.what() << std::endl;
                        }
                    }
                    
                    // Удаляем сессию из Redis
                    // Просто очищаем значение (set с пустой строкой)
                    redis.set(redis_key, "");
                    std::cout << "  -> Session cleared from Redis" << std::endl;
                }
            } catch (const std::exception& redis_err) {
                // Логируем ошибку Redis, но продолжаем
                std::cerr << "  -> Redis error during logout: " << redis_err.what() << std::endl;
            }
        }
        
        // Очищаем куку - правильный синтаксис для Crow
        ctx.set_cookie("session_token", "")
           .max_age(0)       // Немедленное удаление
           .path("/")        // Путь
           .httponly();      // Без аргументов!
        
        std::cout << "  -> Cookie cleared, redirecting to /" << std::endl;
        
        res.redirect("/");
        
    } catch (const std::exception& e) {
        std::cerr << "Error in /logout: " << e.what() << std::endl;
        res.redirect("/");
    }
});

CROW_ROUTE(app, "/api/status")
.methods("GET"_method)([&app, &redis](const crow::request& req, crow::response& res) {
    try {
        auto& ctx = app.get_context<crow::CookieParser>(req);
        auto session_cookie = ctx.get_cookie("session_token");
        
        crow::json::wvalue response;
        
        if (session_cookie.empty()) {
            response["status"] = "unknown";
            response["authenticated"] = false;
            res.add_header("Content-Type", "application/json");
            res.write(response.dump());
            return;
        }
        
        std::string redis_key = "session:" + session_cookie;
        std::string session_data = redis.get(redis_key);
        
        if (session_data.empty()) {
            response["status"] = "unknown";
            response["authenticated"] = false;
            res.add_header("Content-Type", "application/json");
            res.write(response.dump());
            return;
        }
        
        SessionData session = SessionData::from_redis_string(session_data);
        response["status"] = session.status;
        response["authenticated"] = session.is_authorized();
        
        // Если пользователь анонимный, проверяем статус токена входа
        // НО: по ТЗ это должно происходить не в /api/status, а при обработке основного запроса
        // /api/status только информирует фронтенд
        
        if (session.is_anonymous()) {
            response["has_login_token"] = !session.login_token.empty();
            
            // Фронтенд может использовать эту информацию для периодической проверки
            // Но фактическую проверку и переход между статусами делает сервер
            // при обработке запросов пользователя
        }
        
        res.add_header("Content-Type", "application/json");
        res.write(response.dump());
        
    } catch (const std::exception& e) {
        std::cerr << "Error in /api/status: " << e.what() << std::endl;
        res.code = 500;
        crow::json::wvalue error;
        error["error"] = "Internal server error";
        res.write(error.dump());
    }
});

CROW_CATCHALL_ROUTE(app)([&app, &redis](const crow::request& req) {
    std::string path = req.url;
    
    // Только базовые проверки
    auto& ctx = app.get_context<crow::CookieParser>(req);
    auto session_cookie = ctx.get_cookie("session_token");
    
    // Все неизвестные/анонимные пользователи → на главную
    if (session_cookie.empty()) {
        auto res = crow::response(302);
        res.add_header("Location", "/");
        return res;
    }
    
    std::string redis_key = "session:" + session_cookie;
    std::string session_data = redis.get(redis_key);
    
    if (session_data.empty()) {
        auto res = crow::response(302);
        res.add_header("Location", "/");
        return res;
    }
    
    SessionData session = SessionData::from_redis_string(session_data);
    
    // Анонимные → на главную
    if (session.is_anonymous()) {
        auto res = crow::response(302);
        res.add_header("Location", "/");
        return res;
    }
    
    // Авторизованные → 404 (временно, пока не реализована бизнес-логика)
    if (session.is_authorized()) {
        // Можно вернуть JSON для API и HTML для остального
        if (path.find("/api/") == 0) {
            crow::json::wvalue response;
            response["error"] = "Not implemented";
            response["message"] = "This API endpoint is not yet implemented";
            
            auto res = crow::response(501);
            res.add_header("Content-Type", "application/json");
            res.write(response.dump());
            return res;
        } else {
            auto res = crow::response(404);
            res.write("Page not found");
            return res;
        }
    }
    
    // По умолчанию
    auto res = crow::response(302);
    res.add_header("Location", "/");
    return res;
});

CROW_ROUTE(app, "/api/user/profile")
.methods("GET"_method)([&app, &redis](const crow::request& req, crow::response& res) {
    try {
        auto& ctx = app.get_context<crow::CookieParser>(req);
        
        // Проверяем авторизацию
        auto auth_result = check_authorization(redis, ctx, res);
        if (!auth_result.first) {
            return;
        }
        
        SessionData session = auth_result.second;
        
        // Добавляем CORS заголовки
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Content-Type", "application/json");
        
        // Временный заглушечный ответ
        crow::json::wvalue response;
        response["user_id"] = session.user_id;
        response["full_name"] = std::string("Иван Иванов");
        response["email"] = std::string("user@example.com");
        
        auto roles = crow::json::wvalue::list();
        roles.push_back(std::string("student"));
        response["roles"] = std::move(roles);
        
        res.write(response.dump());  // Исправлено: response.dump()
        
    } catch (const std::exception& e) {
        std::cerr << "Error in /api/user/profile: " << e.what() << std::endl;
        res.code = 500;
        crow::json::wvalue error;
        error["error"] = std::string("Internal server error");
        error["message"] = std::string(e.what());
        res.write(error.dump());  // Исправлено
    }
});

// Обновленный маршрут /api/courses
CROW_ROUTE(app, "/api/courses")
.methods("GET"_method)([&app, &redis](const crow::request& req, crow::response& res) {
    try {
        auto& ctx = app.get_context<crow::CookieParser>(req);
        
        // Проверяем авторизацию
        auto auth_result = check_authorization(redis, ctx, res);
        if (!auth_result.first) {
            return;
        }
        
        SessionData session = auth_result.second;
        
        // Добавляем CORS заголовки
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Content-Type", "application/json");
        
        // Временный заглушечный ответ
        crow::json::wvalue response;
        
        auto courses_array = crow::json::wvalue::list();
        
        // Курс 1
        crow::json::wvalue course1;
        course1["id"] = std::string("1");
        course1["name"] = std::string("Математика");
        course1["description"] = std::string("Основы математического анализа");
        courses_array.push_back(std::move(course1));
        
        // Курс 2
        crow::json::wvalue course2;
        course2["id"] = std::string("2");
        course2["name"] = std::string("Физика");
        course2["description"] = std::string("Классическая механика");
        courses_array.push_back(std::move(course2));
        
        // Курс 3
        crow::json::wvalue course3;
        course3["id"] = std::string("3");
        course3["name"] = std::string("Программирование");
        course3["description"] = std::string("Основы C++ и алгоритмов");
        courses_array.push_back(std::move(course3));
        
        response["courses"] = std::move(courses_array);
        response["count"] = 3;
        
        res.write(response.dump());  // Исправлено: response.dump()
        
    } catch (const std::exception& e) {
        std::cerr << "Error in /api/courses: " << e.what() << std::endl;
        res.code = 500;
        crow::json::wvalue error;
        error["error"] = std::string("Internal server error");
        error["message"] = std::string(e.what());
        res.write(error.dump());  // Исправлено
    }
});

// Маршрут OPTIONS для CORS
CROW_ROUTE(app, "/api/<path>")
.methods("OPTIONS"_method)([](const crow::request& req, crow::response& res, std::string path) {
    res.add_header("Access-Control-Allow-Origin", "*");
    res.add_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.add_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.add_header("Access-Control-Max-Age", "86400"); // 24 часа
    res.code = 204; // No Content
    res.end();
});

    app.port(18080).multithreaded().run();
    return 0;
}