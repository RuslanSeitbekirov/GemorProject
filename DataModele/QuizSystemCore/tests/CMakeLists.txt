# Конфигурация тестов для Google Test
cmake_minimum_required(VERSION 3.20)

# Включаем тестирование
enable_testing()

# Добавляем директорию с тестами
add_subdirectory(unit)
add_subdirectory(integration)

# Функция для регистрации тестов
function(add_quiz_test test_name test_source)
    add_executable(${test_name} ${test_source})
    
    target_include_directories(${test_name} PRIVATE
        ${CMAKE_SOURCE_DIR}/include
        ${CMAKE_SOURCE_DIR}/tests
        ${GTEST_INCLUDE_DIRS}
    )
    
    target_link_libraries(${test_name} PRIVATE
        quiz_system_core
        GTest::gtest_main
        GTest::gmock
    )
    
    add_test(NAME ${test_name} COMMAND ${test_name})
    
    # Установка тестов
    install(TARGETS ${test_name}
        RUNTIME DESTINATION tests
    )
endfunction()

# Глобальные настройки для тестов
if(WIN32)
    # На Windows добавляем необходимые библиотеки
    set(COMMON_LIBS ws2_32 crypt32)
endif()