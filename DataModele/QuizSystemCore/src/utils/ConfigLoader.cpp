#include <filesystem>
#include "../../include/Utils/ConfigLoader.h"
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_color_sinks.h>

using namespace QuizSystem::Utils;

ConfigLoader::ConfigLoader() {
    // Не создаём логгер здесь - он будет получен при первом использовании
    m_logger = nullptr; // Явно инициализируем как nullptr
}

bool ConfigLoader::load(const std::string& configPath) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    // Получаем логгер при первом использовании
    if (!m_logger) {
        m_logger = spdlog::get("config");
        if (!m_logger) {
            // Если логгера "config" нет, используем default
            m_logger = spdlog::default_logger();
        }
    }
    
    try {
        // Проверяем существование файла
        if (!std::filesystem::exists(configPath)) {
            if (m_logger) {
                m_logger->warn("Config file not found: {}, using default config", configPath);
            }
            loadDefaultConfig();
            return false;
        }
        
        // Читаем файл
        std::ifstream configFile(configPath);
        if (!configFile.is_open()) {
            if (m_logger) {
                m_logger->error("Failed to open config file: {}", configPath);
            }
            return false;
        }
        
        // Парсим JSON
        m_config = nlohmann::json::parse(configFile);
        configFile.close();
        
        if (m_logger) {
            m_logger->info("Config loaded from: {}", configPath);
            
            // Логируем основные настройки
            if (m_config.contains("environment")) {
                m_logger->info("Environment: {}", m_config["environment"].get<std::string>());
            }
            
            if (m_config.contains("debug")) {
                m_logger->info("Debug mode: {}", m_config["debug"].get<bool>());
            }
        }
        
        return true;
        
    } catch (const nlohmann::json::parse_error& e) {
        if (m_logger) {
            m_logger->error("JSON parse error in config file: {}", e.what());
        }
        loadDefaultConfig();
        return false;
    } catch (const std::exception& e) {
        if (m_logger) {
            m_logger->error("Failed to load config: {}", e.what());
        }
        loadDefaultConfig();
        return false;
    }
}

// ВСЕ остальные методы остаются как есть, но добавляем проверку m_logger:

bool ConfigLoader::save(const std::string& configPath) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    // Получаем логгер если нужно
    if (!m_logger) {
        m_logger = spdlog::get("config");
        if (!m_logger) m_logger = spdlog::default_logger();
    }
    
    try {
        // Создаем директорию если не существует
        std::filesystem::path path(configPath);
        std::filesystem::create_directories(path.parent_path());
        
        // Записываем в файл
        std::ofstream configFile(configPath);
        if (!configFile.is_open()) {
            if (m_logger) {
                m_logger->error("Failed to open config file for writing: {}", configPath);
            }
            return false;
        }
        
        configFile << m_config.dump(4);
        configFile.close();
        
        if (m_logger) {
            m_logger->info("Config saved to: {}", configPath);
        }
        return true;
        
    } catch (const std::exception& e) {
        if (m_logger) {
            m_logger->error("Failed to save config: {}", e.what());
        }
        return false;
    }
}

nlohmann::json ConfigLoader::get(const std::string& key) const {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    try {
        nlohmann::json::json_pointer ptr("/" + key);
        return m_config.at(ptr);
    } catch (const std::exception& e) {
        if (m_logger) {
            m_logger->warn("Config key not found: {}", key);
        }
        return nlohmann::json();
    }
}

// В методе set тоже добавляем получение логгера:
void ConfigLoader::set(const std::string& key, const nlohmann::json& value) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    // Получаем логгер если нужно
    if (!m_logger) {
        m_logger = spdlog::get("config");
        if (!m_logger) m_logger = spdlog::default_logger();
    }
    
    try {
        nlohmann::json::json_pointer ptr("/" + key);
        m_config[ptr] = value;
        
        if (m_logger) {
            m_logger->debug("Config key set: {} = {}", key, value.dump());
        }
    } catch (const std::exception& e) {
        if (m_logger) {
            m_logger->error("Failed to set config key {}: {}", key, e.what());
        }
    }
}

void ConfigLoader::loadDefaultConfig() {
    // Конфигурация по умолчанию
    m_config = {
        {"environment", "development"},
        {"debug", true},
        {"database", {
            {"host", "localhost"},
            {"port", 5432},
            {"name", "quiz_system"},
            {"user", "quiz_app"},
            {"password", "QuizAppPassword123!"},
            {"pool_size", 10},
            {"timeout", 30},
            {"ssl_mode", "disable"}
        }},
        {"server", {
            {"host", "0.0.0.0"},
            {"port", 8080},
            {"workers", 4},
            {"timeout", 60},
            {"cors", {
                {"enabled", true},
                {"origins", {"http://localhost:3000", "http://localhost:8080"}}
            }}
        }},
        {"logging", {
            {"level", "debug"},
            {"file", "logs/quiz_system.log"},
            {"max_size", "10MB"},
            {"max_files", 5},
            {"format", "[%Y-%m-%d %H:%M:%S.%e] [%n] [%^%l%$] %v"}
        }},
        {"security", {
            {"jwt_secret", "your-secret-key-change-in-production"},
            {"jwt_expiry_hours", 24},
            {"bcrypt_rounds", 12}
        }},
        {"features", {
            {"enable_swagger", true},
            {"enable_metrics", true},
            {"enable_profiling", false}
        }}
    };
    
    // Получаем логгер если нужно
    if (!m_logger) {
        m_logger = spdlog::get("config");
        if (!m_logger) m_logger = spdlog::default_logger();
    }
    
    if (m_logger) {
        m_logger->info("Default config loaded");
    }
} // ← ЭТА ЗАКРЫВАЮЩАЯ СКОБКА ОЧЕНЬ ВАЖНА!

// ✅ Теперь добавляем реализации недостающих методов

std::string ConfigLoader::getEnvironment() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    try {
        return m_config.at("environment").get<std::string>();
    } catch (const std::exception&) {
        return "development";
    }
}

bool ConfigLoader::isDebug() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    try {
        return m_config.at("debug").get<bool>();
    } catch (const std::exception&) {
        return false;
    }
}
