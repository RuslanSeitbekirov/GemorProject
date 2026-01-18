cmake_minimum_required(VERSION 3.16)
project(Group_project)
set(CMAKE_CXX_STANDARD 20)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

find_package(Crow REQUIRED)
find_package(redis++ REQUIRED)

#добавление фронтенд директорий
cmake_path(SET STATIC_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/static)
cmake_path(SET TEMPLATES_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/templates)

if(CMAKE_BUILD_TYPE STREQUAL "Debug") 
    add_custom_target(
        frontend ALL 
        COMMAND ${CMAKE_COMMAND} -E create_symlink ${STATIC_SOURCE_DIR} ${CMAKE_BINARY_DIR}/static
        COMMAND ${CMAKE_COMMAND} -E create_symlink ${TEMPLATES_SOURCE_DIR} ${CMAKE_BINARY_DIR}/templates
        COMMENT "Create frontend symlinks" 
    )
else()
    add_custom_target(
        frontend ALL 
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${STATIC_SOURCE_DIR} ${CMAKE_BINARY_DIR}/bin/static
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${TEMPLATES_SOURCE_DIR} ${CMAKE_BINARY_DIR}/bin/templates
        COMMENT "Merge frontend files..."
    )
endif()

add_executable(web_app webserver.cpp redis_client.hpp)
add_dependencies(web_app frontend)
target_link_libraries(web_app Crow::Crow redis++::redis++_static)