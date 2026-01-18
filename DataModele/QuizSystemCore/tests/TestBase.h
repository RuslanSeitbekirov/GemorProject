#ifndef TESTBASE_H
#define TESTBASE_H

#include <gtest/gtest.h>
#include <memory>
#include <spdlog/spdlog.h>
#include <spdlog/sinks/null_sink.h>

namespace QuizSystem {
namespace Tests {

// Базовый класс для всех тестов
class TestBase : public ::testing::Test {
protected:
    // Настройка перед каждым тестом
    void SetUp() override {
        // Настраиваем логгер для тестов (используем null sink чтобы не засорять вывод)
        auto null_sink = std::make_shared<spdlog::sinks::null_sink_mt>();
        auto test_logger = std::make_shared<spdlog::logger>("test", null_sink);
        spdlog::set_default_logger(test_logger);
    }
    
    // Очистка после каждого теста
    void TearDown() override {
        spdlog::shutdown();
    }
    
    // Вспомогательные методы
    static std::string getTestDataPath(const std::string& filename = "") {
        std::string path = "test_data/";
        if (!filename.empty()) {
            path += filename;
        }
        return path;
    }
    
    static void createTestDataDirectory() {
        #ifdef _WIN32
            system("mkdir test_data 2>nul");
        #else
            system("mkdir -p test_data");
        #endif
    }
};

} // namespace Tests
} // namespace QuizSystem

#endif // TESTBASE_H