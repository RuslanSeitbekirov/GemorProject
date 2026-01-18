#ifndef DATETIME_H
#define DATETIME_H

#include <string>
#include <chrono>
#include <ctime>

namespace QuizSystem {
namespace Utils {

class DateTime {
public:
    // Получение текущего времени
    static std::chrono::system_clock::time_point now();
    
    // Конвертация времени в строку ISO 8601
    static std::string toISOString(const std::chrono::system_clock::time_point& time);
    
    // Конвертация времени в строку с пользовательским форматом
    static std::string toString(const std::chrono::system_clock::time_point& time,
                               const std::string& format = "%Y-%m-%d %H:%M:%S");
    
    // Парсинг строки во время
    static std::chrono::system_clock::time_point fromString(const std::string& timeStr,
                                                           const std::string& format = "%Y-%m-%d %H:%M:%S");
    
    // Форматирование продолжительности
    static std::string formatDuration(std::chrono::seconds duration);
    
    // Проверка, истекло ли время
    static bool isExpired(const std::chrono::system_clock::time_point& time,
                         std::chrono::seconds maxAge);
    
    // Добавление времени
    static std::chrono::system_clock::time_point addSeconds(
        const std::chrono::system_clock::time_point& time,
        std::chrono::seconds seconds);
    
    static std::chrono::system_clock::time_point addMinutes(
        const std::chrono::system_clock::time_point& time,
        std::chrono::minutes minutes);
    
    static std::chrono::system_clock::time_point addHours(
        const std::chrono::system_clock::time_point& time,
        std::chrono::hours hours);
    
    static std::chrono::system_clock::time_point addDays(
        const std::chrono::system_clock::time_point& time,
        std::chrono::hours days);
    
private:
    DateTime() = delete;
    ~DateTime() = delete;
};

} // namespace Utils
} // namespace QuizSystem

#endif // DATETIME_H