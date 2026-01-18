#include "TestBase.h"
#include "utils/ConfigLoader.h"
#include <filesystem>
#include <fstream>

using namespace QuizSystem::Utils;
using namespace QuizSystem::Tests;

class ConfigLoaderTest : public TestBase {
protected:
    void SetUp() override {
        TestBase::SetUp();
        
        // Создаем временный конфиг файл для тестов
        createTestConfig();
    }
    
    void TearDown() override {
        // Удаляем временный файл
        if (std::filesystem::exists(testConfigPath)) {
            std::filesystem::remove(testConfigPath);
        }
        
        TestBase::TearDown();
    }
    
    void createTestConfig() {
        testConfigPath = getTestDataPath("test_config.json");
        
        nlohmann::json config = {
            {"environment", "test"},
            {"debug", true},
            {"database", {
                {"host", "localhost"},
                {"port", 5432},
                {"name", "test_db"}
            }},
            {"server", {
                {"port", 8081},
                {"timeout", 30}
            }}
        };
        
        // Создаем директорию если не существует
        std::filesystem::create_directories(std::filesystem::path(testConfigPath).parent_path());
        
        // Записываем в файл
        std::ofstream file(testConfigPath);
        file << config.dump(4);
        file.close();
    }
    
    std::string testConfigPath;
};

// Тест singleton паттерна
TEST_F(ConfigLoaderTest, Singleton) {
    ConfigLoader& instance1 = ConfigLoader::getInstance();
    ConfigLoader& instance2 = ConfigLoader::getInstance();
    
    // Должны быть одним и тем же объектом
    EXPECT_EQ(&instance1, &instance2);
}

// Тест загрузки конфигурации из файла
TEST_F(ConfigLoaderTest, LoadFromFile) {
    ConfigLoader& config = ConfigLoader::getInstance();
    
    EXPECT_TRUE(config.load(testConfigPath));
    
    // Проверяем загруженные значения
    EXPECT_EQ(config.getValue<std::string>("environment"), "test");
    EXPECT_EQ(config.getValue<bool>("debug"), true);
    EXPECT_EQ(config.getValue<int>("database.port"), 5432);
    EXPECT_EQ(config.getValue<std::string>("database.host"), "localhost");
}

// Тест загрузки несуществующего файла
TEST_F(ConfigLoaderTest, LoadNonExistentFile) {
    ConfigLoader& config = ConfigLoader::getInstance();
    
    EXPECT_FALSE(config.load("non_existent_config.json"));
    
    // Должны использоваться значения по умолчанию
    EXPECT_EQ(config.getEnvironment(), "development");
}

// Тест получения значений с типом
TEST_F(ConfigLoaderTest, GetValueTyped) {
    ConfigLoader& config = ConfigLoader::getInstance();
    config.load(testConfigPath);
    
    // Получение существующих значений
    EXPECT_EQ(config.getValue<std::string>("environment"), "test");
    EXPECT_EQ(config.getValue<bool>("debug"), true);
    EXPECT_EQ(config.getValue<int>("server.port"), 8081);
    
    // Получение несуществующих значений с дефолтом
    EXPECT_EQ(config.getValue<std::string>("non.existent", "default"), "default");
    EXPECT_EQ(config.getValue<int>("non.existent", 999), 999);
    EXPECT_EQ(config.getValue<bool>("non.existent", false), false);
}

// Тест проверки существования ключа
TEST_F(ConfigLoaderTest, HasKey) {
    ConfigLoader& config = ConfigLoader::getInstance();
    config.load(testConfigPath);
    
    EXPECT_TRUE(config.has("environment"));
    EXPECT_TRUE(config.has("database.host"));
    EXPECT_TRUE(config.has("server.port"));
    EXPECT_FALSE(config.has("non.existent"));
    EXPECT_FALSE(config.has("database.non.existent"));
}

// Тест установки значений
TEST_F(ConfigLoaderTest, SetValue) {
    ConfigLoader& config = ConfigLoader::getInstance();
    
    // Устанавливаем новое значение
    config.set("test.key", "test_value");
    config.set("test.nested.key", 123);
    config.set("test.boolean", true);
    
    // Проверяем установленные значения
    EXPECT_EQ(config.getValue<std::string>("test.key"), "test_value");
    EXPECT_EQ(config.getValue<int>("test.nested.key"), 123);
    EXPECT_EQ(config.getValue<bool>("test.boolean"), true);
    
    // Перезаписываем значение
    config.set("test.key", "new_value");
    EXPECT_EQ(config.getValue<std::string>("test.key"), "new_value");
}

// Тест получения окружения
TEST_F(ConfigLoaderTest, GetEnvironment) {
    ConfigLoader& config = ConfigLoader::getInstance();
    config.load(testConfigPath);
    
    EXPECT_EQ(config.getEnvironment(), "test");
}

// Тест проверки режима отладки
TEST(ConfigLoaderTest, SingletonInstance) {
    auto& loader = QuizSystem::Utils::ConfigLoader::getInstance();  // ← Используйте getInstance()
    ASSERT_NE(&loader, nullptr);
}

// Тест сохранения конфигурации
TEST_F(ConfigLoaderTest, SaveConfig) {
    ConfigLoader& config = ConfigLoader::getInstance();
    
    // Устанавливаем тестовые значения
    config.set("save.test.key", "save_test_value");
    config.set("save.test.number", 456);
    
    // Сохраняем в файл
    std::string savePath = getTestDataPath("save_config.json");
    EXPECT_TRUE(config.save(savePath));
    
    // Проверяем, что файл создан
    EXPECT_TRUE(std::filesystem::exists(savePath));
    
    // Загружаем обратно и проверяем
    ConfigLoader newConfig;
    EXPECT_TRUE(newConfig.load(savePath));
    EXPECT_EQ(newConfig.getValue<std::string>("save.test.key"), "save_test_value");
    EXPECT_EQ(newConfig.getValue<int>("save.test.number"), 456);
    
    // Удаляем временный файл
    std::filesystem::remove(savePath);
}