#include <iostream>
#include <csignal>
#include <atomic>
#include <thread>
#include <memory>

#include <spdlog/spdlog.h>

#include "utils/Logger.h"
#include "utils/ConfigLoader.h"
#include "core/Application.h"

using namespace QuizSystem;

// Глобальный флаг для graceful shutdown
std::atomic<bool> g_shutdownRequested(false);

// Обработчик сигналов
void signalHandler(int signal) {
    std::cout << "\n🛑 Получен сигнал завершения: ";
    switch (signal) {
        case SIGINT:  std::cout << "SIGINT (Ctrl+C)"; break;
        case SIGTERM: std::cout << "SIGTERM"; break;
        default:      std::cout << signal; break;
    }
    std::cout << std::endl;
    
    g_shutdownRequested = true;
}

// Печать баннера приложения
void printBanner() {
    std::cout << R"(
    ╔══════════════════════════════════════════════════════╗
    ║      🚀 Quiz System Core - Система тестирования      ║
    ║                   Версия 1.0.0                      ║
    ║                                                      ║
    ║      🔗 API: http://localhost:8080                   ║
    ║      📊 PGAdmin: http://localhost:5050               ║
    ║      🗄️  База данных: localhost:5432/quiz_system     ║
    ║                                                      ║
    ║      Для остановки нажмите Ctrl+C                    ║
    ╚══════════════════════════════════════════════════════╝
    )" << std::endl;
}

// Инициализация приложения
bool initializeApplication() {
    auto logger = spdlog::get("main");
    if (!logger) {
        std::cerr << "❌ Логгер не инициализирован!" << std::endl;
        return false;
    }
    
    logger->info("🚀 Инициализация Quiz System Core...");
    
    // 1. Загрузка конфигурации
    logger->info("📋 Загрузка конфигурации...");
    auto& config = Utils::ConfigLoader::getInstance();
    
    std::string configFile = "config/development.json";
    if (!config.load(configFile)) {
        logger->warn("Не удалось загрузить конфигурацию из {}, используются значения по умолчанию", 
                    configFile);
    }
    
    // Логируем настройки
    logger->info("Окружение: {}", config.getEnvironment());
    logger->info("Режим отладки: {}", config.isDebug() ? "включен" : "выключен");
    
    // 2. Настройка логгера из конфигурации
    auto logConfig = config.get("logging");
    if (!logConfig.is_null()) {
        std::string logLevel = logConfig.value("level", "info");
        std::string logFile = logConfig.value("file", "logs/quiz_system.log");
        
        Utils::Logger::setLevel(logLevel);
        logger->info("Уровень логирования: {}", logLevel);
        logger->info("Файл логов: {}", logFile);
    }
    
    return true;
}

int main(int argc, char* argv[]) {
    // Регистрируем обработчики сигналов
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);
    
    try {
        // 1. Печать баннера
        printBanner();
        
        // 2. Инициализация логгера
        Utils::Logger::initialize();
        auto logger = spdlog::get("main");

        // Создаём логгер для config если нужно
        if (!spdlog::get("config")) {
        auto configLogger = spdlog::stdout_color_mt("config");
        configLogger->set_level(spdlog::level::info);
        }
        
        if (!logger) {
            std::cerr << "❌ Не удалось инициализировать логгер!" << std::endl;
            return 1;
        }
        
        logger->info("🎯 Логгер инициализирован");
        
        //  Создаём ConfigLoader ПОСЛЕ инициализации логгера
        auto& config = Utils::ConfigLoader::getInstance();
        
        // 3. Инициализация приложения
        if (!initializeApplication()) {
            logger->error("❌ Ошибка инициализации приложения");
            return 1;
        }
        
        // 4. Создание и запуск приложения
        logger->info("🎮 Создание приложения...");
        auto app = std::make_unique<Core::Application>();
        
        if (!app->initialize()) {
            logger->error("❌ Не удалось инициализировать приложение");
            return 1;
        }
        
        logger->info("▶️  Запуск приложения...");
        app->start();
        
        logger->info("✅ Приложение успешно запущено");
        logger->info("══════════════════════════════════════════════════════");
        
        // 5. Главный цикл приложения
        while (!g_shutdownRequested) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            
            // Проверка состояния приложения
            if (!app->isRunning()) {
                logger->warn("⚠️  Приложение остановлено");
                g_shutdownRequested = true;
            }
        }
        
        // 6. Остановка приложения
        logger->info("🛑 Остановка приложения...");
        app->stop();
        
        logger->info("👋 Приложение остановлено");
        
    } catch (const std::exception& e) {
        std::cerr << "\n💥 Критическая ошибка: " << e.what() << std::endl;
        
        auto logger = spdlog::get("main");
        if (logger) {
            logger->critical("Критическая ошибка: {}", e.what());
        }
        
        return 1;
    }
    
    // 7. Завершение работы системы логирования
    Utils::Logger::shutdown();
    
    std::cout << "\n✨ Quiz System Core завершил работу\n" << std::endl;
    return 0;
}