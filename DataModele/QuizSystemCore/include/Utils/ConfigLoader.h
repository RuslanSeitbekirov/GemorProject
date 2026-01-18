#ifndef CONFIGLOADER_H
#define CONFIGLOADER_H

#include <string>
#include <memory>
#include <nlohmann/json.hpp>
#include <fstream>
#include <mutex>
#include <spdlog/spdlog.h>

namespace QuizSystem {
namespace Utils {

class ConfigLoader {
public:
    // Singleton instance
    static ConfigLoader& getInstance() {
        static ConfigLoader instance;
        return instance;
    }
    
    // Загрузка конфигурации из файла
    bool load(const std::string& configPath = "config/development.json");
    
    // Сохранение конфигурации в файл
    bool save(const std::string& configPath = "config/development.json");
    
    // Получение значения по ключу
    nlohmann::json get(const std::string& key) const;
    
    // Получение значения с типом и значением по умолчанию
    template<typename T>
    T getValue(const std::string& key, T defaultValue = T()) const;
    
    // Установка значения
    void set(const std::string& key, const nlohmann::json& value);
    
    // Проверка существования ключа
    bool has(const std::string& key) const;
    
    // Получение всей конфигурации
    const nlohmann::json& getConfig() const { return m_config; }
    
    // Получение окружения
    std::string getEnvironment() const;
    
    // Проверка режима отладки
    bool isDebug() const;
    
    // Удаление копирования и присваивания
    ConfigLoader(const ConfigLoader&) = delete;
    ConfigLoader& operator=(const ConfigLoader&) = delete;
    
private:
    ConfigLoader();
    ~ConfigLoader() = default;
    
    nlohmann::json m_config;
    mutable std::mutex m_mutex;
    std::shared_ptr<spdlog::logger> m_logger;
    
    // Загрузка конфигурации по умолчанию
    void loadDefaultConfig();
};

// Шаблонная реализация getValue
template<typename T>
T ConfigLoader::getValue(const std::string& key, T defaultValue) const {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    try {
        nlohmann::json::json_pointer ptr("/" + key);
        return m_config.at(ptr).get<T>();
    } catch (const std::exception& e) {
        if (m_logger) {
            m_logger->warn("Config key not found: {}, using default value", key);
        }
        return defaultValue;
    }
}

} // namespace Utils
} // namespace QuizSystem

#endif // CONFIGLOADER_H