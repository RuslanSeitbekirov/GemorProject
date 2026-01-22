#!/bin/sh
set -e

host="$1"
port="$2"
shift 2

echo "Ожидание Redis на $host:$port..."
until nc -z "$host" "$port"; do
  echo "Redis еще не готов, ждем..."
  sleep 1
done

echo "Redis готов, запускаем приложение..."
exec "$@"
