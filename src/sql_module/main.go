package main

import (
	"flag"
	"log" 
	"sql_module/internal/config"
	"sql_module/internal/server"
	"sql_module/pkg/database"

	_ "github.com/lib/pq"
)

func main() {
	port := flag.String("port", "", "Порт для HTTP сервера (Пример : \"8080\")")

	flag.Parse()

	cfg := config.Load()

	if *port != "" {
		cfg.PortServer = *port
		if cfg.PortServer[0] != ':' {
			cfg.PortServer = ":" + cfg.PortServer
		}
	}

	log.Printf("Server running from port: %s", cfg.PortServer)

	db, err := database.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Error connecting to DB: %v", err)
	}
	defer db.Close()

	log.Println("Подключение есть, радуемся жизни!")

	if err := db.DB.Ping(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Подключено к базе данных")

	srv := server.NewServer(db.DB)

	log.Printf("Запускаем сервер на http://localhost%s", cfg.PortServer)
	if err := srv.Start(cfg.PortServer); err != nil {
		log.Fatalf("Ошибка: %v", err)
	}
}
