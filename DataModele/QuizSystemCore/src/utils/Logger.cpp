// src/utils/Logger.cpp
#include "Utils/Logger.h"
#include <filesystem>
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/sinks/rotating_file_sink.h>
#include <memory>
#include <vector>
#include <iostream>

namespace QuizSystem::Utils {

bool Logger::m_initialized = false;
std::string Logger::m_logFile = "";

void Logger::initialize(const std::string& logLevel,
                       const std::string& logFile,
                       size_t maxFileSize,
                       size_t maxFiles) {
    if (m_initialized) {
        return;
    }
    
    m_logFile = logFile;
    
    try {
        // Создаем директорию для логов если не существует
        std::filesystem::path logPath(logFile);
        std::filesystem::create_directories(logPath.parent_path());
        
        // Создаем логгеры для разных модулей
        std::vector<std::string> loggerNames = {
            "main", "database", "server", "api", "models",
            "services", "repositories", "utils", "config"
        };
        
        for (const auto& name : loggerNames) {
            createLogger(name);
        }
        
        // Устанавливаем уровень логирования
        setLevel(logLevel);
        
        m_initialized = true;
        
        auto defaultLogger = getDefaultLogger();
        if (defaultLogger) {
            defaultLogger->info("Logger system initialized");
            defaultLogger->info("Log file: {}", logFile);
            defaultLogger->info("Log level: {}", logLevel);
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Failed to initialize logger: " << e.what() << std::endl;
    }
}

std::shared_ptr<spdlog::logger> Logger::createLogger(const std::string& name) {
    try {
        // Проверяем, существует ли уже логгер
        auto existingLogger = spdlog::get(name);
        if (existingLogger) {
            return existingLogger;
        }
        
        // Создаем sink'и
        std::vector<spdlog::sink_ptr> sinks;
        
        // Консольный sink
        auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
        console_sink->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v");
        
        // Файловый sink (ротирующий)
        if (!m_logFile.empty()) {
            auto file_sink = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
                m_logFile, 1048576 * 10, 5);
            file_sink->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%n] [%^%l%$] %v");
            sinks.push_back(file_sink);
        }
        
        sinks.push_back(console_sink);
        
        // Создаем логгер
        auto logger = std::make_shared<spdlog::logger>(name, sinks.begin(), sinks.end());
        
        // Регистрируем логгер
        spdlog::register_logger(logger);
        
        // Устанавливаем уровень по умолчанию
        logger->set_level(spdlog::level::info);
        
        return logger;
        
    } catch (const std::exception& e) {
        std::cerr << "Failed to create logger " << name << ": " << e.what() << std::endl;
        return nullptr;
    }
}

std::shared_ptr<spdlog::logger> Logger::getLogger(const std::string& name) {
    if (!m_initialized) {
        // Автоматическая инициализация с настройками по умолчанию
        initialize("info", "logs/app.log", 10485760, 5);
    }
    
    auto logger = spdlog::get(name);
    if (!logger) {
        // Создаем логгер если не существует
        logger = createLogger(name);
    }
    
    return logger;
}

std::shared_ptr<spdlog::logger> Logger::getDefaultLogger() {
    return getLogger("main");
}

void Logger::setLevel(const std::string& level) {
    // Конвертируем строку в уровень spdlog
    spdlog::level::level_enum logLevel;
    
    if (level == "trace") {
        logLevel = spdlog::level::trace;
    } else if (level == "debug") {
        logLevel = spdlog::level::debug;
    } else if (level == "info") {
        logLevel = spdlog::level::info;
    } else if (level == "warn") {
        logLevel = spdlog::level::warn;
    } else if (level == "error") {
        logLevel = spdlog::level::err;
    } else if (level == "critical") {
        logLevel = spdlog::level::critical;
    } else {
        logLevel = spdlog::level::info; // По умолчанию
    }
    
    // Устанавливаем уровень для всех известных логгеров
    std::vector<std::string> loggerNames = {
    "main", "database", "server", "api", "models",
    "services", "repositories", "utils"
    // "config" создаётся в другом месте
};
    
    for (const auto& name : loggerNames) {
        auto logger = spdlog::get(name);
        if (logger) {
            logger->set_level(logLevel);
        }
    }
    
    // Также устанавливаем уровень по умолчанию
    spdlog::set_level(logLevel);
}

void Logger::shutdown() {
    spdlog::shutdown();
    m_initialized = false;
}

} // namespace QuizSystem::Utils