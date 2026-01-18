#include "models/User.h"
#include <algorithm>
#include <spdlog/spdlog.h>
#include <sstream>      // для std::istringstream
#include <iomanip>      // для std::get_time
#include <chrono>       // для std::chrono

using namespace QuizSystem::Models;

User::User()
    : m_id(0)
    , m_email("")
    , m_fullName("")
    , m_passwordHash("")
    , m_createdAt(std::chrono::system_clock::now())
    , m_updatedAt(std::chrono::system_clock::now())
    , m_isActive(true) {
}

User::User(int id, const std::string& email, const std::string& fullName)
    : m_id(id)
    , m_email(email)
    , m_fullName(fullName)
    , m_passwordHash("")
    , m_createdAt(std::chrono::system_clock::now())
    , m_updatedAt(std::chrono::system_clock::now())
    , m_isActive(true) {
}

void User::addRole(UserRole role) {
    if (!hasRole(role)) {
        m_roles.push_back(role);
        
        auto logger = spdlog::get("models");
        if (logger) {
            logger->debug("Added role {} to user {}", userRoleToString(role), m_email);
        }
    }
}

void User::removeRole(UserRole role) {
    auto it = std::remove(m_roles.begin(), m_roles.end(), role);
    if (it != m_roles.end()) {
        m_roles.erase(it, m_roles.end());
        
        auto logger = spdlog::get("models");
        if (logger) {
            logger->debug("Removed role {} from user {}", userRoleToString(role), m_email);
        }
    }
}

bool User::hasRole(UserRole role) const {
    return std::find(m_roles.begin(), m_roles.end(), role) != m_roles.end();
}

bool User::isValid() const {
    if (m_email.empty()) {
        return false;
    }
    
    // Простая валидация email
    if (m_email.find('@') == std::string::npos) {
        return false;
    }
    
    if (m_fullName.empty()) {
        return false;
    }
    
    return true;
}

nlohmann::json User::toJson() const {
    nlohmann::json json;
    
    json["id"] = m_id;
    json["email"] = m_email;
    json["full_name"] = m_fullName;
    json["is_active"] = m_isActive;
    
    // Конвертируем время в строку ISO 8601
    auto timeToString = [](const std::chrono::system_clock::time_point& time) {
        auto tt = std::chrono::system_clock::to_time_t(time);
        std::tm tm;
        localtime_s(&tm, &tt);
        char buffer[80];
        std::strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S", &tm);
        return std::string(buffer);
    };
    
    json["created_at"] = timeToString(m_createdAt);
    json["updated_at"] = timeToString(m_updatedAt);
    
    // Конвертируем роли в массив строк
    nlohmann::json rolesJson = nlohmann::json::array();
    for (const auto& role : m_roles) {
        rolesJson.push_back(userRoleToString(role));
    }
    json["roles"] = rolesJson;
    
    // Не включаем пароль в JSON для безопасности
    
    return json;
}

User User::fromJson(const nlohmann::json& json) {
    User user;
    
    if (json.contains("id")) {
        user.m_id = json["id"].get<int>();
    }
    
    if (json.contains("email")) {
        user.m_email = json["email"].get<std::string>();
    }
    
    if (json.contains("full_name")) {
        user.m_fullName = json["full_name"].get<std::string>();
    }
    
    if (json.contains("password")) {
        user.m_passwordHash = json["password"].get<std::string>();
    }
    
    if (json.contains("is_active")) {
        user.m_isActive = json["is_active"].get<bool>();
    }
    
    // Парсим роли
    if (json.contains("roles") && json["roles"].is_array()) {
        for (const auto& roleJson : json["roles"]) {
            try {
                UserRole role = stringToUserRole(roleJson.get<std::string>());
                user.addRole(role);
            } catch (const std::invalid_argument& e) {
                auto logger = spdlog::get("models");
                if (logger) {
                    logger->warn("Invalid role in JSON: {}", e.what());
                }
            }
        }
    }
    
    // Парсим даты (если есть)
    auto parseTime = [](const std::string& timeStr) -> std::chrono::system_clock::time_point {
        if (timeStr.empty()) {
            return std::chrono::system_clock::now();
        }
        
        std::tm tm = {};
        std::istringstream ss(timeStr);
        ss >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
        if (ss.fail()) {
            return std::chrono::system_clock::now();
        }
        
        auto tt = std::mktime(&tm);
        return std::chrono::system_clock::from_time_t(tt);
    };
    
    if (json.contains("created_at")) {
        user.m_createdAt = parseTime(json["created_at"].get<std::string>());
    }
    
    if (json.contains("updated_at")) {
        user.m_updatedAt = parseTime(json["updated_at"].get<std::string>());
    }
    
    return user;
}

bool User::operator==(const User& other) const {
    return m_id == other.m_id &&
           m_email == other.m_email &&
           m_fullName == other.m_fullName &&
           m_isActive == other.m_isActive;
}