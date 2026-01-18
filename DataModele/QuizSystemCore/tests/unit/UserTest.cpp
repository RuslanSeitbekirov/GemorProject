#include "TestBase.h"
#include "models/User.h"
#include <chrono>

using namespace QuizSystem::Models;
using namespace QuizSystem::Tests;

// Тестовый класс для User
class UserTest : public TestBase {
protected:
    void SetUp() override {
        TestBase::SetUp();
        
        // Создаем тестового пользователя
        testUser = User(1, "test@example.com", "Test User");
        testUser.addRole(UserRole::Student);
        testUser.addRole(UserRole::Teacher);
    }
    
    User testUser;
};

// Тест конструктора по умолчанию
TEST_F(UserTest, DefaultConstructor) {
    User user;
    
    EXPECT_EQ(user.getId(), 0);
    EXPECT_TRUE(user.getEmail().empty());
    EXPECT_TRUE(user.getFullName().empty());
    EXPECT_TRUE(user.isActive());
    EXPECT_TRUE(user.getRoles().empty());
}

// Тест параметризованного конструктора
TEST_F(UserTest, ParameterizedConstructor) {
    User user(123, "user@test.com", "John Doe");
    
    EXPECT_EQ(user.getId(), 123);
    EXPECT_EQ(user.getEmail(), "user@test.com");
    EXPECT_EQ(user.getFullName(), "John Doe");
    EXPECT_TRUE(user.isActive());
}

// Тест валидации пользователя
TEST_F(UserTest, Validation) {
    // Валидный пользователь
    EXPECT_TRUE(testUser.isValid());
    
    // Невалидные пользователи
    User invalidUser1(0, "", "Test User");
    EXPECT_FALSE(invalidUser1.isValid());
    
    User invalidUser2(0, "invalid-email", "Test User");
    EXPECT_FALSE(invalidUser2.isValid());
    
    User invalidUser3(0, "test@example.com", "");
    EXPECT_FALSE(invalidUser3.isValid());
}

// Тест добавления и удаления ролей
TEST_F(UserTest, RoleManagement) {
    User user;
    
    // Добавление ролей
    user.addRole(UserRole::Admin);
    user.addRole(UserRole::Teacher);
    
    EXPECT_EQ(user.getRoles().size(), 2);
    EXPECT_TRUE(user.hasRole(UserRole::Admin));
    EXPECT_TRUE(user.hasRole(UserRole::Teacher));
    EXPECT_FALSE(user.hasRole(UserRole::Student));
    
    // Повторное добавление той же роли не должно дублироваться
    user.addRole(UserRole::Admin);
    EXPECT_EQ(user.getRoles().size(), 2);
    
    // Удаление роли
    user.removeRole(UserRole::Teacher);
    EXPECT_EQ(user.getRoles().size(), 1);
    EXPECT_TRUE(user.hasRole(UserRole::Admin));
    EXPECT_FALSE(user.hasRole(UserRole::Teacher));
    
    // Удаление несуществующей роли
    user.removeRole(UserRole::Student);
    EXPECT_EQ(user.getRoles().size(), 1);
}

// Тест сериализации в JSON
TEST_F(UserTest, JsonSerialization) {
    // Сериализация
    auto json = testUser.toJson();
    
    EXPECT_EQ(json["id"], testUser.getId());
    EXPECT_EQ(json["email"], testUser.getEmail());
    EXPECT_EQ(json["full_name"], testUser.getFullName());
    EXPECT_EQ(json["is_active"], testUser.isActive());
    
    // Проверяем роли
    auto roles = json["roles"];
    EXPECT_TRUE(roles.is_array());
    EXPECT_EQ(roles.size(), 2);
    
    // Десериализация
    User deserializedUser = User::fromJson(json);
    
    EXPECT_EQ(deserializedUser.getId(), testUser.getId());
    EXPECT_EQ(deserializedUser.getEmail(), testUser.getEmail());
    EXPECT_EQ(deserializedUser.getFullName(), testUser.getFullName());
    EXPECT_EQ(deserializedUser.isActive(), testUser.isActive());
    EXPECT_EQ(deserializedUser.getRoles().size(), testUser.getRoles().size());
}

// Тест десериализации из JSON
TEST_F(UserTest, JsonDeserialization) {
    nlohmann::json json = {
        {"id", 100},
        {"email", "json@test.com"},
        {"full_name", "JSON User"},
        {"is_active", false},
        {"roles", {"admin", "teacher"}},
        {"created_at", "2024-01-15T10:30:00"},
        {"updated_at", "2024-01-15T11:45:00"}
    };
    
    User user = User::fromJson(json);
    
    EXPECT_EQ(user.getId(), 100);
    EXPECT_EQ(user.getEmail(), "json@test.com");
    EXPECT_EQ(user.getFullName(), "JSON User");
    EXPECT_FALSE(user.isActive());
    
    // Проверяем роли
    EXPECT_EQ(user.getRoles().size(), 2);
    EXPECT_TRUE(user.hasRole(UserRole::Admin));
    EXPECT_TRUE(user.hasRole(UserRole::Teacher));
    
    // Пароль не должен быть в JSON
    EXPECT_TRUE(user.getPasswordHash().empty());
}

// Тест сравнения пользователей
TEST_F(UserTest, Comparison) {
    User user1(1, "test@example.com", "Test User");
    User user2(1, "test@example.com", "Test User");
    User user3(2, "other@example.com", "Other User");
    
    EXPECT_EQ(user1, user2);
    EXPECT_NE(user1, user3);
    EXPECT_NE(user2, user3);
}

// Тест конвертации ролей
TEST_F(UserTest, RoleConversion) {
    EXPECT_EQ(userRoleToString(UserRole::Admin), "admin");
    EXPECT_EQ(userRoleToString(UserRole::Teacher), "teacher");
    EXPECT_EQ(userRoleToString(UserRole::Student), "student");
    
    EXPECT_EQ(stringToUserRole("admin"), UserRole::Admin);
    EXPECT_EQ(stringToUserRole("teacher"), UserRole::Teacher);
    EXPECT_EQ(stringToUserRole("student"), UserRole::Student);
    
    // Исключение для неизвестной роли
    EXPECT_THROW(stringToUserRole("unknown"), std::invalid_argument);
}