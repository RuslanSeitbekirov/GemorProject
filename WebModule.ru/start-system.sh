#!/bin/bash

echo "🚀 Запуск системы тестирования..."

# Проверяем, запущен ли Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker не запущен. Запустите Docker Desktop и попробуйте снова."
    exit 1
fi

# Запускаем PostgreSQL контейнер
echo "🐘 Запуск PostgreSQL контейнера..."
docker start TestDataBase > /dev/null 2>&1 || docker run --name TestDataBase -p 5438:5432 -e POSTGRES_PASSWORD=12345 -d postgres

# Ждем запуска PostgreSQL
echo "⏳ Ожидание запуска PostgreSQL..."
sleep 5

# Устанавливаем зависимости
echo "📦 Установка зависимостей..."
npm install

# Запускаем сервер
echo "🌐 Запуск сервера..."
npm start