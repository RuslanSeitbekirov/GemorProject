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


var ctx = context.Background()
var rdb *redis.Client

func initRedis() {
	// Получаем настройки Redis из переменных окружения
	redis_host = os.getenv("REDIS_HOST", "localhost")
	redis_port = os.getenv("REDIS_PORT", 6379)
	redisAddr := os.Getenv("REDIS_ADDR")
	redisPassword := os.Getenv("REDIS_PASSWORD")
	redisDB, _ := strconv.Atoi(os.Getenv("REDIS_DB"))

	// Создаем клиент Redis
	rdb = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       redisDB,
	})

	// Проверяем подключение
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Printf("Ошибка подключения к Redis: %v", err)
	} else {
		log.Println("Успешное подключение к Redis")
	}
}

func main() {


	// Загружаем переменные окружения
	err := godotenv.Load()
	if err != nil {
		log.Printf("Ошибка загрузки .env файла: %v", err)
	}

	// Получаем токен из переменной окружения
	token := os.Getenv("TOKEN")
	if token == "" {
		log.Fatal("TOKEN не установлен")
	}

	// Инициализируем Redis
	initRedis()
	defer rdb.Close()

	// Создаем бота
	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		log.Fatal(err)
	}

	bot.Debug = true
	log.Printf("Авторизован как %s", bot.Self.UserName)

	// Настраиваем получение обновлений
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	// Обрабатываем обновления
	for update := range updates {
		if update.Message == nil {
			continue
		}

		if !update.Message.IsCommand() && update.Message.Text == "" {
			continue
		}

		if update.Message.IsCommand() {
			handleCommand(bot, update.Message)
			continue
		}
	}
}

// Обработчик команд
func handleCommand(bot *tgbotapi.BotAPI, message *tgbotapi.Message) {
	msg := tgbotapi.NewMessage(message.Chat.ID, "")

	switch message.Command() {
	case "start":
		msg.Text = "Привет! Я простой бот. Отправь мне /help для списка команд."

	case "help":
		msg.Text = `Доступные команды:
/start - начать работу
/help - показать справку
/echo [текст] - повторить текст
/about - информация о боте
/set [ключ] [значение] - сохранить данные
/get [ключ] - получить данные
/delete [ключ] - удалить данные
/getUsers - получить список пользователей
/getUserFIO - получить свое ФИО
/updateUserFIO [ФИО] - обновить свое ФИО`

	case "echo":
		if len(message.CommandArguments()) > 0 {
			msg.Text = message.CommandArguments()
		} else {
			msg.Text = "Пожалуйста, укажите текст после команды /echo"
		}

	case "set":
		args := strings.Fields(message.CommandArguments())
		if len(args) < 2 {
			msg.Text = "Использование: /set ключ значение"
			break
		}
		key := args[0]
		value := strings.Join(args[1:], " ")

		err := rdb.Set(ctx, key, value, 0).Err()
		if err != nil {
			msg.Text = fmt.Sprintf("Ошибка сохранения: %v", err)
		} else {
			msg.Text = fmt.Sprintf("Сохранено: %s = %s", key, value)
		}

	case "get":
		key := message.CommandArguments()
		if key == "" {
			msg.Text = "Использование: /get ключ"
			break
		}

		val, err := rdb.Get(ctx, key).Result()
		if err == redis.Nil {
			msg.Text = "Ключ не найден"
		} else if err != nil {
			msg.Text = fmt.Sprintf("Ошибка получения: %v", err)
		} else {
			msg.Text = fmt.Sprintf("%s = %s", key, val)
		}

	case "delete":
		key := message.CommandArguments()
		if key == "" {
			msg.Text = "Использование: /delete ключ"
			break
		}

		err := rdb.Del(ctx, key).Err()
		if err != nil {
			msg.Text = fmt.Sprintf("Ошибка удаления: %v", err)
		} else {
			msg.Text = "Ключ удален"
		}

	case "getUsers":
		// Получаем все ключи пользователей
		keys, err := rdb.Keys(ctx, "user:*").Result()
		if err != nil {
			msg.Text = fmt.Sprintf("Ошибка получения пользователей: %v", err)
			break
		}

		if len(keys) == 0 {
			msg.Text = "Пользователей нет"
			break
		}

		var users []string
		for _, key := range keys {
			userData, err := rdb.HGetAll(ctx, key).Result()
			if err == nil {
				username := userData["username"]
				if username == "" {
					username = "без имени"
				}
				users = append(users, fmt.Sprintf("- %s", username))
			}
		}

		msg.Text = "Пользователи:\n" + strings.Join(users, "\n")

	case "getUserFIO":
		userKey := fmt.Sprintf("user:%d", message.From.ID)
		fio, err := rdb.HGet(ctx, userKey, "fio").Result()
		if err == redis.Nil {
			msg.Text = "ФИО не установлено. Используйте /updateUserFIO [ваше ФИО]"
		} else if err != nil {
			msg.Text = fmt.Sprintf("Ошибка получения ФИО: %v", err)
		} else {
			msg.Text = fmt.Sprintf("Ваше ФИО: %s", fio)
		}

	case "updateUserFIO":
		fio := message.CommandArguments()
		if fio == "" {
			msg.Text = "Использование: /updateUserFIO [ваше ФИО]"
			break
		}

		userKey := fmt.Sprintf("user:%d", message.From.ID)
		err := rdb.HSet(ctx, userKey, "fio", fio).Err()
		if err != nil {
			msg.Text = fmt.Sprintf("Ошибка обновления ФИО: %v", err)
		} else {
			msg.Text = "ФИО обновлено"
		}

	case "about":
		msg.Text = "Это простой бот на Go. Создан для демонстрации."

	default:
		msg.Text = "Неизвестная команда. Используйте /help для списка команд."
	}

	bot.Send(msg)
}
