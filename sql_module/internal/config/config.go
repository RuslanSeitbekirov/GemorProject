package config

import "os"

type Config struct {
	DatabaseURL string
	PortServer  string
	JWTSecret   string
}

var jwtSecret = []byte("your-secret-key-change-in-production")

func Load() *Config {
	return &Config{
		DatabaseURL: getenv("DATABASE_URL", "host=localhost user=postgres password=password dbname=poll_system sslmode=disable"),
		PortServer:  getenv("SERVER_PORT", ":8080"),
		JWTSecret:   getenv("JWT_SECRET", "your-secret-key-change-in-production"),
	}
}

func getenv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
