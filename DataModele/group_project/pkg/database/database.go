package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

type Database struct {
	DB *sql.DB
}

// подключаемся к бд
func New(connestionString string) (*Database, error) {
	db, err := sql.Open("postgres", connestionString)
	if err != nil {
		return nil, fmt.Errorf("ошибка подключения к бд: %w", err)
	}
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ошибка пинга к БД: %w", err)
	}
	log.Println("Успешное подключение к базе данных")
	return &Database{DB: db}, nil
}

// отключение от бд
func (d *Database) Close() error {
	return d.DB.Close()
}
