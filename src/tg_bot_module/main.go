package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

var (
	ctx = context.Background()
	rdb *redis.Client
	bot *tgbotapi.BotAPI
)

// initRedis инициализирует подключение к Redis
func initRedis() error {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379" // значение по умолчанию
	}
	redisPassword := os.Getenv("REDIS_PASSWORD")
	redisDB, _ := strconv.Atoi(os.Getenv("REDIS_DB"))

	rdb = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       redisDB,
	})

	// Проверяем подключение
	if err := rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("ошибка подключения к Redis: %w", err)
	}

	log.Println("Успешное подключение к Redis")
	return nil
}

// userKey генерирует ключ для хранения данных пользователя
func userKey(userID int64) string {
	return fmt.Sprintf("user:%d", userID)
}

func main() {
	// Загружаем переменные окружения
	if err := godotenv.Load(); err != nil {
		log.Printf("Предупреждение: не удалось загрузить .env файл: %v", err)
	}

	// Получаем токен из переменной окружения
	token := os.Getenv("TOKEN")
	if token == "" {
		log.Fatal("TOKEN не установлен")
	}

	// Инициализируем бота
	var err error
	bot, err = tgbotapi.NewBotAPI(token)
	if err != nil {
		log.Fatalf("Ошибка создания бота: %v", err)
	}

	bot.Debug = os.Getenv("DEBUG") == "true"
	log.Printf("Авторизован как %s", bot.Self.UserName)

	// Инициализируем Redis
	if err := initRedis(); err != nil {
		log.Printf("Предупреждение: %v", err)
		log.Println("Работаем без Redis, некоторые функции будут недоступны")
	} else {
		defer rdb.Close()
	}

	// Настраиваем обновления
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	// Обрабатываем обновления
	for update := range updates {
		if update.Message == nil {
			continue
		}

		// Обрабатываем только текстовые сообщения и команды
		if update.Message.Text == "" {
			continue
		}

		handleMessage(update.Message)
	}
}

// handleMessage обрабатывает входящие сообщения
func handleMessage(message *tgbotapi.Message) {
	msg := tgbotapi.NewMessage(message.Chat.ID, "")

	if message.IsCommand() {
		handleCommand(message, &msg)
	} else {
		handleText(message, &msg)
	}

	if msg.Text != "" {
		msg.ParseMode = tgbotapi.ModeMarkdown
		if _, err := bot.Send(msg); err != nil {
			log.Printf("Ошибка отправки сообщения: %v", err)
		}
	}
}

// handleCommand обрабатывает команды
func handleCommand(message *tgbotapi.Message, msg *tgbotapi.MessageConfig) {
	switch message.Command() {
	case "start":
		msg.Text = "Привет! Я простой бот. Отправь мне /help для списка команд."
		updateUserInfo(message.From) // Сохраняем информацию о пользователе

	case "help":
		msg.Text = `*Доступные команды:*
/start - начать работу
/help - показать справку
/about - информация о боте
/set [ключ] [значение] - сохранить данные
/get [ключ] - получить данные
/delete [ключ] - удалить данные
/getUsers - получить список пользователей
/getUserFIO - получить свое ФИО
/updateUserFIO [ФИО] - обновить свое ФИО`

	case "about":
		msg.Text = "*О боте*\nЭто демонстрационный бот на Go\nИспользует Redis для хранения данных"

	case "set":
		handleSetCommand(message, msg)

	case "get":
		handleGetCommand(message, msg)

	case "delete":
		handleDeleteCommand(message, msg)

	case "getUsers":
		handleGetUsersCommand(message, msg)

	case "getUserFIO":
		handleGetUserFIOCommand(message, msg)

	case "updateUserFIO":
		handleUpdateUserFIOCommand(message, msg)

	default:
		msg.Text = "Неизвестная команда. Используйте /help для списка команд."
	}
}

// handleText обрабатывает текстовые сообщения (не команды)
func handleText(message *tgbotapi.Message, msg *tgbotapi.MessageConfig) {
	msg.Text = fmt.Sprintf("Вы написали: %s\n\nИспользуйте /help для списка команд", message.Text)
}

// updateUserInfo обновляет информацию о пользователе в Redis
func updateUserInfo(user *tgbotapi.User) {
	if rdb == nil {
		return
	}

	userKey := userKey(int64(user.ID))
	data := map[string]interface{}{
		"username":   user.UserName,
		"first_name": user.FirstName,
		"last_name":  user.LastName,
	}

	if err := rdb.HSet(ctx, userKey, data).Err(); err != nil {
		log.Printf("Ошибка сохранения данных пользователя: %v", err)
	}
}

// Обработчики конкретных команд
func handleSetCommand(message *tgbotapi.Message, msg *tgbotapi.MessageConfig) {
	if rdb == nil {
		msg.Text = "Redis недоступен"
		return
	}

	args := strings.Fields(message.CommandArguments())
	if len(args) < 2 {
		msg.Text = "Использование: /set ключ значение"
		return
	}

	key := args[0]
	value := strings.Join(args[1:], " ")

	if err := rdb.Set(ctx, key, value, 0).Err(); err != nil {
		msg.Text = fmt.Sprintf("Ошибка сохранения: %v", err)
	} else {
		msg.Text = fmt.Sprintf("✅ Сохранено:\n*%s* = `%s`", key, value)
	}
}

func handleGetCommand(message *tgbotapi.Message, msg *tgbotapi.MessageConfig) {
	if rdb == nil {
		msg.Text = "Redis недоступен"
		return
	}

	key := strings.TrimSpace(message.CommandArguments())
	if key == "" {
		msg.Text = "Использование: /get ключ"
		return
	}

	val, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		msg.Text = "❌ Ключ не найден"
	} else if err != nil {
		msg.Text = fmt.Sprintf("Ошибка получения: %v", err)
	} else {
		msg.Text = fmt.Sprintf("*%s* = `%s`", key, val)
	}
}

func handleDeleteCommand(message *tgbotapi.Message, msg *tgbotapi.MessageConfig) {
	if rdb == nil {
		msg.Text = "Redis недоступен"
		return
	}

	key := strings.TrimSpace(message.CommandArguments())
	if key == "" {
		msg.Text = "Использование: /delete ключ"
		return
	}

	if err := rdb.Del(ctx, key).Err(); err != nil {
		msg.Text = fmt.Sprintf("Ошибка удаления: %v", err)
	} else {
		msg.Text = "✅ Ключ удален"
	}
}

func handleGetUsersCommand(message *tgbotapi.Message, msg *tgbotapi.MessageConfig) {
	if rdb == nil {
		msg.Text = "Redis недоступен"
		return
	}

	keys, err := rdb.Keys(ctx, "user:*").Result()
	if err != nil {
		msg.Text = fmt.Sprintf("Ошибка получения пользователей: %v", err)
		return
	}

	if len(keys) == 0 {
		msg.Text = "📭 Пользователей нет"
		return
	}

	var users []string
	for i, key := range keys {
		userData, err := rdb.HGetAll(ctx, key).Result()
		if err != nil {
			continue
		}

		username := "без имени"
		if name := userData["username"]; name != "" {
			username = "@" + name
		} else if firstName := userData["first_name"]; firstName != "" {
			username = firstName
			if lastName := userData["last_name"]; lastName != "" {
				username += " " + lastName
			}
		}

		users = append(users, fmt.Sprintf("%d. %s", i+1, username))
	}

	msg.Text = "👥 *Пользователи:*\n" + strings.Join(users, "\n")
}

func handleGetUserFIOCommand(message *tgbotapi.Message, msg *tgbotapi.MessageConfig) {
	if rdb == nil {
		msg.Text = "Redis недоступен"
		return
	}

	userKey := userKey(int64(message.From.ID))
	fio, err := rdb.HGet(ctx, userKey, "fio").Result()
	if err == redis.Nil {
		msg.Text = "📝 ФИО не установлено\nИспользуйте: /updateUserFIO [ваше ФИО]"
	} else if err != nil {
		msg.Text = fmt.Sprintf("Ошибка получения ФИО: %v", err)
	} else {
		msg.Text = fmt.Sprintf("📋 *Ваше ФИО:* %s", fio)
	}
}

func handleUpdateUserFIOCommand(message *tgbotapi.Message, msg *tgbotapi.MessageConfig) {
	if rdb == nil {
		msg.Text = "Redis недоступен"
		return
	}

	fio := strings.TrimSpace(message.CommandArguments())
	if fio == "" {
		msg.Text = "Использование: /updateUserFIO [ваше ФИО]"
		return
	}

	userKey := userKey(int64(message.From.ID))
	if err := rdb.HSet(ctx, userKey, "fio", fio).Err(); err != nil {
		msg.Text = fmt.Sprintf("Ошибка обновления ФИО: %v", err)
	} else {
		updateUserInfo(message.From) // Обновляем общую информацию о пользователе
		msg.Text = "✅ ФИО обновлено"
	}
}
