#!/bin/bash
# Полный тестовый скрипт для SQL Module
# Автоматически тестирует все эндпоинты API

# ============================================
# КОНФИГУРАЦИЯ
# ============================================

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Базовый URL API
BASE_URL="http://localhost:8080"
API_URL="$BASE_URL/api"

# Глобальные переменные для хранения данных между тестами
declare -g ADMIN_TOKEN=""
declare -g TEACHER_TOKEN=""
declare -g STUDENT_TOKEN=""
declare -g ADMIN_ID=""
declare -g TEACHER_ID=""
declare -g STUDENT_ID=""
declare -g COURSE_ID=""
declare -g TEST_ID=""
declare -g QUESTION_ID=""
declare -g QUESTION2_ID=""
declare -g ATTEMPT_ID=""
declare -g NOTIFICATION_ID=""

# Счетчики тестов
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# ============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================

# Вывод заголовка теста
print_header() {
    echo -e "\n${PURPLE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC} ${CYAN}$1${NC}"
    echo -e "${PURPLE}╚════════════════════════════════════════════════════════════╝${NC}"
}

# Вывод подзаголовка
print_subheader() {
    echo -e "\n${BLUE}» $1${NC}"
}

# Утилита для выполнения curl с обработкой ошибок
curl_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local token="$4"
    local expected_status="$5"
    local test_name="$6"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${YELLOW}Тест:${NC} $test_name"
    echo -e "${YELLOW}Запрос:${NC} $method $endpoint"
    
    if [ -n "$data" ]; then
        echo -e "${YELLOW}Данные:${NC} $data"
    fi
    
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method '$API_URL$endpoint'"
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    if [ -n "$token" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $token'"
    fi
    
    # Выполняем запрос
    local response
    response=$(eval $curl_cmd 2>/dev/null)
    
    # Разделяем JSON ответ и HTTP статус
    local json_response=$(echo "$response" | head -n -1)
    local http_status=$(echo "$response" | tail -n 1)
    
    echo -e "${YELLOW}Статус:${NC} $http_status"
    echo -e "${YELLOW}Ответ:${NC} $json_response"
    
    # Проверяем статус
    if [ "$http_status" -eq "$expected_status" ] || [ -z "$expected_status" ]; then
        echo -e "${GREEN}✓ УСПЕХ${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Сохраняем ID из ответа если нужно
        if [[ "$json_response" == *'"id"'* ]]; then
            local id=$(echo "$json_response" | grep -o '"id":[0-9]*' | cut -d: -f2 | head -1)
            echo -e "${GREEN}Создан ID: $id${NC}"
            echo "$id"
        fi
    else
        echo -e "${RED}✗ ОШИБКА: ожидался статус $expected_status, получен $http_status${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo ""
    fi
    
    echo ""
}

# Сохранение значения в переменную
save_value() {
    local var_name="$1"
    local value="$2"
    eval "$var_name=\"$value\""
}

# Извлечение значения из JSON ответа
extract_value() {
    local json="$1"
    local field="$2"
    echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | cut -d'"' -f4
}

extract_id() {
    local json="$1"
    echo "$json" | grep -o '"id":[0-9]*' | cut -d: -f2
}

# ============================================
# ТЕСТЫ АУТЕНТИФИКАЦИИ
# ============================================

test_auth() {
    print_header "ТЕСТИРОВАНИЕ АУТЕНТИФИКАЦИИ"
    
    print_subheader "1. Регистрация администратора"
    ADMIN_JSON='{"full_name":"Тестовый Админ","email":"admin@test.com","password":"admin123","role":"admin"}'
    response=$(curl_request "POST" "/register" "$ADMIN_JSON" "" 201 "Регистрация админа")
    ADMIN_ID=$(extract_id "$response")
    save_value "ADMIN_ID" "$ADMIN_ID"
    
    print_subheader "2. Регистрация преподавателя"
    TEACHER_JSON='{"full_name":"Тестовый Преподаватель","email":"teacher@test.com","password":"teacher123","role":"teacher"}'
    response=$(curl_request "POST" "/register" "$TEACHER_JSON" "" 201 "Регистрация преподавателя")
    TEACHER_ID=$(extract_id "$response")
    save_value "TEACHER_ID" "$TEACHER_ID"
    
    print_subheader "3. Регистрация студента"
    STUDENT_JSON='{"full_name":"Тестовый Студент","email":"student@test.com","password":"student123"}'
    response=$(curl_request "POST" "/register" "$STUDENT_JSON" "" 201 "Регистрация студента")
    STUDENT_ID=$(extract_id "$response")
    save_value "STUDENT_ID" "$STUDENT_ID"
    
    print_subheader "4. Логин администратора"
    LOGIN_ADMIN='{"email":"admin@test.com","password":"admin123"}'
    response=$(curl_request "POST" "/login" "$LOGIN_ADMIN" "" 200 "Логин админа")
    ADMIN_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    save_value "ADMIN_TOKEN" "$ADMIN_TOKEN"
    
    print_subheader "5. Логин преподавателя"
    LOGIN_TEACHER='{"email":"teacher@test.com","password":"teacher123"}'
    response=$(curl_request "POST" "/login" "$LOGIN_TEACHER" "" 200 "Логин преподавателя")
    TEACHER_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    save_value "TEACHER_TOKEN" "$TEACHER_TOKEN"
    
    print_subheader "6. Логин студента"
    LOGIN_STUDENT='{"email":"student@test.com","password":"student123"}'
    response=$(curl_request "POST" "/login" "$LOGIN_STUDENT" "" 200 "Логин студента")
    STUDENT_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    save_value "STUDENT_TOKEN" "$STUDENT_TOKEN"
}

# ============================================
# ТЕСТЫ ПОЛЬЗОВАТЕЛЕЙ
# ============================================

test_users() {
    print_header "ТЕСТИРОВАНИЕ ПОЛЬЗОВАТЕЛЕЙ"
    
    print_subheader "1. Получение списка пользователей (админ)"
    curl_request "GET" "/users" "" "$ADMIN_TOKEN" 200 "Получить список пользователей"
    
    print_subheader "2. Получение информации о пользователе"
    curl_request "GET" "/users/$ADMIN_ID" "" "$ADMIN_TOKEN" 200 "Получить информацию об админе"
    
    print_subheader "3. Создание пользователя (админ)"
    NEW_USER='{"full_name":"Новый Пользователь","email":"new@test.com","password":"newpass123"}'
    response=$(curl_request "POST" "/users" "$NEW_USER" "$ADMIN_TOKEN" 201 "Создать нового пользователя")
    
    print_subheader "4. Получение ролей пользователя"
    curl_request "GET" "/users/$ADMIN_ID/roles" "" "$ADMIN_TOKEN" 200 "Получить роли админа"
    
    print_subheader "5. Обновление ролей пользователя (админ)"
    UPDATE_ROLES='{"roles":["admin","teacher"]}'
    curl_request "PUT" "/users/$TEACHER_ID/roles" "$UPDATE_ROLES" "$ADMIN_TOKEN" 200 "Обновить роли преподавателя"
    
    print_subheader "6. Блокировка пользователя (админ)"
    curl_request "POST" "/users/$STUDENT_ID/block" "" "$ADMIN_TOKEN" 200 "Заблокировать студента"
    
    print_subheader "7. Проверка статуса блокировки"
    curl_request "GET" "/users/$STUDENT_ID/block-status" "" "$ADMIN_TOKEN" 200 "Проверить статус блокировки"
    
    print_subheader "8. Разблокировка пользователя"
    curl_request "POST" "/users/$STUDENT_ID/unblock" "" "$ADMIN_TOKEN" 200 "Разблокировать студента"
}

# ============================================
# ТЕСТЫ КУРСОВ
# ============================================

test_courses() {
    print_header "ТЕСТИРОВАНИЕ КУРСОВ"
    
    print_subheader "1. Создание курса (преподаватель)"
    COURSE_JSON='{"name":"Тестовый курс","description":"Описание тестового курса","is_active":true}'
    response=$(curl_request "POST" "/courses" "$COURSE_JSON" "$TEACHER_TOKEN" 201 "Создать курс")
    COURSE_ID=$(extract_id "$response")
    save_value "COURSE_ID" "$COURSE_ID"
    
    print_subheader "2. Получение списка курсов"
    curl_request "GET" "/courses" "" "$TEACHER_TOKEN" 200 "Получить список курсов"

    print_subheader "3. Получение информации о курсе"
    curl_request "GET" "/courses/$COURSE_ID" "" "$TEACHER_TOKEN" 200 "Получить информацию о курсе"
    
    print_subheader "4. Обновление курса (преподаватель)"
    UPDATE_COURSE='{"name":"Обновленный курс","description":"Новое описание"}'
    curl_request "PUT" "/courses/$COURSE_ID" "$UPDATE_COURSE" "$TEACHER_TOKEN" 200 "Обновить курс"
    
    print_subheader "5. Запись студента на курс (преподаватель)"
    curl_request "POST" "/courses/$COURSE_ID/students/$STUDENT_ID" "" "$TEACHER_TOKEN" 200 "Записать студента на курс"
    
    print_subheader "6. Получение списка студентов курса"
    curl_request "GET" "/courses/$COURSE_ID/students" "" "$TEACHER_TOKEN" 200 "Получить студентов курса"
    
    print_subheader "7. Мягкое удаление курса (админ)"
    curl_request "DELETE" "/courses/$COURSE_ID" "" "$ADMIN_TOKEN" 200 "Удалить курс"
    
    print_subheader "8. Получение списка удаленных курсов"
    curl_request "GET" "/courses/deleted" "" "$ADMIN_TOKEN" 200 "Получить удаленные курсы"
    
    print_subheader "9. Восстановление курса"
    curl_request "POST" "/courses/$COURSE_ID/restore" "" "$ADMIN_TOKEN" 200 "Восстановить курс"
    
    print_subheader "10. Отчисление студента с курса"
    curl_request "DELETE" "/courses/$COURSE_ID/students/$STUDENT_ID" "" "$TEACHER_TOKEN" 200 "Отчислить студента"
}

# ============================================
# ТЕСТЫ ВОПРОСОВ
# ============================================

test_questions() {
    print_header "ТЕСТИРОВАНИЕ ВОПРОСОВ"
    
    print_subheader "1. Создание вопроса (преподаватель)"
    QUESTION_JSON='{"title":"Язык программирования","text":"Какой язык программирования?","options":["Python","Go"],"correct_option":1,"points":5}'
    response=$(curl_request "POST" "/questions" "$QUESTION_JSON" "$TEACHER_TOKEN" 201 "Создать вопрос")
    QUESTION_ID=$(extract_id "$response")
    save_value "QUESTION_ID" "$QUESTION_ID"
    
    print_subheader "2. Получение информации о вопросе"
    curl_request "GET" "/questions/$QUESTION_ID" "" "$TEACHER_TOKEN" 200 "Получить вопрос"
    
    print_subheader "3. Создание второго вопроса"
    QUESTION2_JSON='{"text":"Второй тестовый вопрос","options":["Да","Нет"],"correct_option":0,"points":3}'
    response=$(curl_request "POST" "/questions" "$QUESTION2_JSON" "$TEACHER_TOKEN" 201 "Создать второй вопрос")
    QUESTION2_ID=$(extract_id "$response")
    save_value "QUESTION2_ID" "$QUESTION2_ID"
    
    print_subheader "4. Получение своих вопросов"
    curl_request "GET" "/my/questions" "" "$TEACHER_TOKEN" 200 "Получить свои вопросы"
    
    print_subheader "5. Обновление вопроса (создание новой версии)"
    UPDATE_QUESTION='{"text":"Обновленный вопрос","options":["Python","Golang"],"correct_option":1,"points":10}'
    curl_request "PUT" "/questions/$QUESTION_ID" "$UPDATE_QUESTION" "$TEACHER_TOKEN" 200 "Обновить вопрос"
    
    print_subheader "6. Получение версий вопроса"
    curl_request "GET" "/questions/$QUESTION_ID/versions" "" "$TEACHER_TOKEN" 200 "Получить версии вопроса"
    
    print_subheader "7. Мягкое удаление вопроса"
    curl_request "DELETE" "/questions/$QUESTION2_ID" "" "$TEACHER_TOKEN" 200 "Удалить вопрос"
    
    print_subheader "8. Получение списка удаленных вопросов"
    curl_request "GET" "/questions/deleted" "" "$ADMIN_TOKEN" 200 "Получить удаленные вопросы"
    
    print_subheader "9. Восстановление вопроса"
    curl_request "POST" "/questions/$QUESTION2_ID/restore" "" "$TEACHER_TOKEN" 200 "Восстановить вопрос"
}

# ============================================
# ТЕСТЫ ТЕСТОВ
# ============================================

test_tests() {
    print_header "ТЕСТИРОВАНИЕ ТЕСТОВ"
    
    print_subheader "1. Создание теста (преподаватель)"
    TEST_JSON='{"title":"Тестовый экзамен","description":"Итоговый тест по курсу","course_id":'$COURSE_ID'}'
    response=$(curl_request "POST" "/tests" "$TEST_JSON" "$TEACHER_TOKEN" 201 "Создать тест")
    TEST_ID=$(extract_id "$response")
    save_value "TEST_ID" "$TEST_ID"
    
    print_subheader "2. Получение информации о тесте"
    curl_request "GET" "/tests/$TEST_ID" "" "$TEACHER_TOKEN" 200 "Получить тест"
    
    print_subheader "3. Добавление вопроса в тест"
    ADD_QUESTION='{"question_id":'$QUESTION_ID'}'
    curl_request "POST" "/tests/$TEST_ID/questions" "$ADD_QUESTION" "$TEACHER_TOKEN" 200 "Добавить вопрос в тест"
    
    print_subheader "4. Получение порядка вопросов"
    curl_request "GET" "/tests/$TEST_ID/questions/order" "" "$TEACHER_TOKEN" 200 "Получить порядок вопросов"
    
    print_subheader "5. Обновление порядка вопросов"
    UPDATE_ORDER='{"question_ids":['$QUESTION_ID']}'
    curl_request "PUT" "/tests/$TEST_ID/questions/order" "$UPDATE_ORDER" "$TEACHER_TOKEN" 200 "Обновить порядок вопросов"
    
    print_subheader "6. Активация теста"
    curl_request "POST" "/tests/$TEST_ID/activate" "" "$TEACHER_TOKEN" 200 "Активировать тест"
    
    print_subheader "7. Получение тестов курса"
    curl_request "GET" "/courses/$COURSE_ID/tests" "" "$TEACHER_TOKEN" 200 "Получить тесты курса"
    
    print_subheader "8. Деактивация теста"
    curl_request "POST" "/tests/$TEST_ID/deactivate" "" "$TEACHER_TOKEN" 200 "Деактивировать тест"
    
    print_subheader "9. Мягкое удаление теста"
    curl_request "DELETE" "/tests/$TEST_ID" "" "$ADMIN_TOKEN" 200 "Удалить тест"
    
    print_subheader "10. Получение удаленных тестов"
    curl_request "GET" "/tests/deleted" "" "$ADMIN_TOKEN" 200 "Получить удаленные тесты"
    
    print_subheader "11. Восстановление теста"
    curl_request "POST" "/tests/$TEST_ID/restore" "" "$ADMIN_TOKEN" 200 "Восстановить тест"
    
    print_subheader "12. Активация теста снова"
    curl_request "POST" "/tests/$TEST_ID/activate" "" "$TEACHER_TOKEN" 200 "Активировать тест снова"
}

# ============================================
# ТЕСТЫ ПОПЫТОК И ОТВЕТОВ
# ============================================

test_attempts() {
    print_header "ТЕСТИРОВАНИЕ ПОПЫТОК И ОТВЕТОВ"
    
    print_subheader "1. Начало попытки (студент)"
    response=$(curl_request "POST" "/tests/$TEST_ID/start" "" "$STUDENT_TOKEN" 201 "Начать попытку")
    ATTEMPT_ID=$(extract_id "$response")
    save_value "ATTEMPT_ID" "$ATTEMPT_ID"
    
    print_subheader "2. Получение информации о попытке"
    curl_request "GET" "/attempts/$ATTEMPT_ID" "" "$STUDENT_TOKEN" 200 "Получить попытку"
    
    print_subheader "3. Отправка ответа"
    ANSWER_JSON='{"question_id":'$QUESTION_ID',"question_version":1,"selected_option":1}'
    curl_request "POST" "/attempts/$ATTEMPT_ID/answer" "$ANSWER_JSON" "$STUDENT_TOKEN" 200 "Отправить ответ"
    
    print_subheader "4. Получение ответов попытки"
    curl_request "GET" "/attempts/$ATTEMPT_ID/answers" "" "$STUDENT_TOKEN" 200 "Получить ответы попытки"
    
    print_subheader "5. Завершение попытки"
    curl_request "POST" "/attempts/$ATTEMPT_ID/complete" "" "$STUDENT_TOKEN" 500 "Завершить попытку"
    
    print_subheader "6. Получение результатов теста (преподаватель)"
    curl_request "GET" "/tests/$TEST_ID/results" "" "$TEACHER_TOKEN" 200 "Получить результаты теста"
    
    print_subheader "7. Отмена попытки (создадим новую)"
    response=$(curl_request "POST" "/tests/$TEST_ID/start" "" "$STUDENT_TOKEN" 201 "Начать вторую попытку")
    ATTEMPT2_ID=$(extract_id "$response")

    if [ -z "$ATTEMPT2_ID" ]; then
    echo -e "${RED}Предупреждение: ATTEMPT2_ID пустой, используем ATTEMPT_ID${NC}"
    ATTEMPT2_ID="$ATTEMPT_ID"
    fi

    curl_request "POST" "/attempts/$ATTEMPT2_ID/cancel" "" "$STUDENT_TOKEN" 200 "Отменить попытку"
}

# ============================================
# ТЕСТЫ УВЕДОМЛЕНИЙ
# ============================================

test_notifications() {
    print_header "ТЕСТИРОВАНИЕ УВЕДОМЛЕНИЙ"
    
    print_subheader "1. Создание тестового уведомления"
    NOTIF_JSON='{"type":"test","title":"Тестовое уведомление","message":"Это тестовое сообщение"}'
    response=$(curl_request "POST" "/notifications/test" "$NOTIF_JSON" "$STUDENT_TOKEN" 201 "Создать уведомление")
    NOTIFICATION_ID=$(extract_id "$response")
    save_value "NOTIFICATION_ID" "$NOTIFICATION_ID"
    
    print_subheader "2. Получение списка уведомлений"
    curl_request "GET" "/notifications" "" "$STUDENT_TOKEN" 200 "Получить уведомления"
    
    print_subheader "3. Получение количества непрочитанных"
    curl_request "GET" "/notifications/unread/count" "" "$STUDENT_TOKEN" 200 "Получить количество непрочитанных"
    
    print_subheader "4. Отметка уведомления как прочитанного"
    curl_request "POST" "/notifications/$NOTIFICATION_ID/read" "" "$STUDENT_TOKEN" 200 "Отметить как прочитанное"
    
    print_subheader "5. Отметка всех как прочитанных"
    curl_request "POST" "/notifications/read/all" "" "$STUDENT_TOKEN" 200 "Отметить все как прочитанные"
    
    print_subheader "6. Удаление уведомления"
    curl_request "DELETE" "/notifications/$NOTIFICATION_ID" "" "$STUDENT_TOKEN" 200 "Удалить уведомление"
    
    print_subheader "7. Удаление всех уведомлений"
    curl_request "DELETE" "/notifications" "" "$STUDENT_TOKEN" 200 "Удалить все уведомления"
}

# ============================================
# ТЕСТЫ ДОСТУПА И ПРАВ
# ============================================

test_permissions() {
    print_header "ТЕСТИРОВАНИЕ ПРАВ ДОСТУПА"
    
    print_subheader "1. Студент пытается создать курс (должна быть ошибка 403)"
    STUDENT_COURSE='{"name":"Курс студента","description":"Не должен работать"}'
    curl_request "POST" "/courses" "$STUDENT_COURSE" "$STUDENT_TOKEN" 403 "Студент создает курс"
    
    print_subheader "2. Студент пытается удалить курс"
    curl_request "DELETE" "/courses/$COURSE_ID" "" "$STUDENT_TOKEN" 403 "Студент удаляет курс"
    
    print_subheader "3. Студент пытается получить удаленные курсы"
    curl_request "GET" "/courses/deleted" "" "$STUDENT_TOKEN" 403 "Студент получает удаленные курсы"
    
    print_subheader "4. Преподаватель пытается удалить чужой вопрос"
    # Сначала создадим вопрос от админа
    ADMIN_QUESTION='{"text":"Вопрос админа","options":["Да","Нет"],"correct_option":0,"points":2}'
    response=$(curl_request "POST" "/questions" "$ADMIN_QUESTION" "$ADMIN_TOKEN" 201 "Админ создает вопрос")
    ADMIN_Q_ID=$(extract_id "$response")
    
    # Преподаватель пытается удалить
    curl_request "DELETE" "/questions/$ADMIN_Q_ID" "" "$TEACHER_TOKEN" 403 "Преподаватель удаляет чужой вопрос"
}

# ============================================
# ЗДОРОВЬЕ СИСТЕМЫ
# ============================================

test_health() {
    print_header "ТЕСТИРОВАНИЕ ЗДОРОВЬЯ СИСТЕМЫ"
    
    print_subheader "1. Проверка health-check"
    curl -s -X GET "$BASE_URL/health"
    echo ""
    
    print_subheader "2. Несуществующий эндпоинт"
    curl_request "GET" "/nonexistent" "" "$ADMIN_TOKEN" 404 "Несуществующий эндпоинт"
}

# ============================================
# ОТЧЕТ И СТАТИСТИКА
# ============================================

print_summary() {
    print_header "ИТОГОВЫЙ ОТЧЕТ"
    
    echo -e "\n${GREEN}=== СТАТИСТИКА ТЕСТИРОВАНИЯ ===${NC}"
    echo -e "Всего тестов: $TOTAL_TESTS"
    echo -e "${GREEN}Успешных: $TESTS_PASSED${NC}"
    echo -e "${RED}Проваленных: $TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!${NC}"
    else
        echo -e "\n${RED}⚠ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛИЛИСЬ${NC}"
    fi
    
    echo -e "\n${CYAN}=== СОЗДАННЫЕ РЕСУРСЫ ===${NC}"
    echo -e "Админ ID: $ADMIN_ID"
    echo -e "Преподаватель ID: $TEACHER_ID"
    echo -e "Студент ID: $STUDENT_ID"
    echo -e "Курс ID: $COURSE_ID"
    echo -e "Тест ID: $TEST_ID"
    echo -e "Вопрос ID: $QUESTION_ID"
    echo -e "Попытка ID: $ATTEMPT_ID"
}

# ============================================
# ОСНОВНАЯ ФУНКЦИЯ
# ============================================

main() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           ТЕСТИРОВАНИЕ SQL MODULE API                     ║"
    echo "║           Полный тестовый скрипт                          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Засекаем время начала
    START_TIME=$(date +%s)
    
    # Запуск всех тестов
    test_auth
    test_users
    test_courses
    test_questions
    test_tests
    test_attempts
    test_notifications
    test_permissions
    test_health
    
    # Время выполнения
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # Итоговый отчет
    print_summary
    
    echo -e "\n${YELLOW}Время выполнения: $DURATION секунд${NC}"
    
    if [ $TESTS_FAILED -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# ============================================
# ЗАПУСК СКРИПТА
# ============================================

# Проверяем, запущен ли сервер
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}Ошибка: Сервер не запущен на $BASE_URL${NC}"
    echo -e "Запустите сервер: go run main.go"
    exit 1
fi

# Запускаем основной скрипт
main