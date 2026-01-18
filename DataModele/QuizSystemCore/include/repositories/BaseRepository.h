#ifndef BASEREPOSITORY_H
#define BASEREPOSITORY_H

#include <memory>
#include <string>
#include <vector>
#include <functional>
#include <libpq-fe.h>
#include <spdlog/spdlog.h>
#include "utils/DateTime.h"

namespace QuizSystem {
namespace Repositories {

class BaseRepository {
public:
    // Конструктор/деструктор
    BaseRepository();
    virtual ~BaseRepository();
    
    // Подключение к базе данных
    bool connect(const std::string& connectionString);
    bool connect(const std::string& host, int port,
                 const std::string& dbname, const std::string& user,
                 const std::string& password);
    
    // Отключение от базы данных
    void disconnect();
    
    // Проверка подключения
    bool isConnected() const;
    
protected:
    // Выполнение SQL запроса
    PGresult* executeQuery(const std::string& sql);
    
    // Выполнение SQL команды (без возврата данных)
    bool executeCommand(const std::string& sql);
    
    // Выполнение подготовленного запроса
    PGresult* executePrepared(const std::string& statementName,
                             const std::vector<std::string>& params);
    
    // Подготовка запроса
    bool prepareStatement(const std::string& statementName,
                         const std::string& sql,
                         int paramCount);
    
    // Начало транзакции
    bool beginTransaction();
    
    // Подтверждение транзакции
    bool commitTransaction();
    
    // Откат транзакции
    bool rollbackTransaction();
    
    // Экранирование строки для SQL
    std::string escapeString(const std::string& str) const;
    
    // Получение последней ошибки
    std::string getLastError() const;
    
    // Логгирование запроса (для отладки)
    void logQuery(const std::string& sql, const std::vector<std::string>& params = {});
    
private:
    PGconn* m_connection;
    std::shared_ptr<spdlog::logger> m_logger;
    
    // Удаляем копирование и присваивание
    BaseRepository(const BaseRepository&) = delete;
    BaseRepository& operator=(const BaseRepository&) = delete;
};

} // namespace Repositories
} // namespace QuizSystem

#endif // BASEREPOSITORY_H