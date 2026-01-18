#ifndef LOGGER_H
#define LOGGER_H

#include <memory>
#include <string>
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/sinks/rotating_file_sink.h>

namespace QuizSystem {
namespace Utils {

class Logger {
public:
    // Инициализация системы логирования
    static void initialize(const std::string& logLevel = "info",
                          const std::string& logFile = "logs/quiz_system.log",
                          size_t maxFileSize = 1048576 * 10, // 10 MB
                          size_t maxFiles = 5);
    
    // Получение логгера по имени
    static std::shared_ptr<spdlog::logger> getLogger(const std::string& name);
    
    // Получение логгера по умолчанию
    static std::shared_ptr<spdlog::logger> getDefaultLogger();
    
    // Установка уровня логирования
    static void setLevel(const std::string& level);
    
    // Завершение работы системы логирования
    static void shutdown();
    
private:
    static bool m_initialized;
    static std::string m_logFile;
    
    // Создание логгера
    static std::shared_ptr<spdlog::logger> createLogger(const std::string& name);
};

} // namespace Utils
} // namespace QuizSystem

#endif // LOGGER_H