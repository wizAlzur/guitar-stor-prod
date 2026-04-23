package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type JWTConfig struct {
	Secret  string
	Expires time.Duration
}

type YooKassaConfig struct {
	ShopID     string
	SecretKey  string
	SuccessURL string
	FailURL    string
	WebhookURL string
}

type ApiKeyConfig struct {
	Admin string
}

type FrontendConfig struct {
	BaseURL            string
	PaymentSuccessPath string
	PaymentFailPath    string
}

type Config struct {
	ServerPort  string
	DatabaseURL string
	RedisURL    string
	JWT         JWTConfig
	YooKassa    YooKassaConfig
	ApiKey      ApiKeyConfig
	Frontend    FrontendConfig
}

func LoadConfig() (*Config, error) {
	_ = godotenv.Overload()

	serverPort := os.Getenv("SERVER_PORT")
	if serverPort == "" {
		serverPort = ":8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	expires := 7 * 24 * time.Hour
	if h := os.Getenv("JWT_EXPIRES_HOURS"); h != "" {
		if hours, err := strconv.Atoi(h); err == nil && hours > 0 {
			expires = time.Duration(hours) * time.Hour
		}
	}

	shopID := os.Getenv("YOOKASSA_SHOP_ID")
	if shopID == "" {
		return nil, fmt.Errorf("YOOKASSA_SHOP_ID is required")
	}

	secretKey := os.Getenv("YOOKASSA_SECRET_KEY")
	if secretKey == "" {
		return nil, fmt.Errorf("YOOKASSA_SECRET_KEY is required")
	}

	successURL := os.Getenv("YOOKASSA_SUCCESS_URL")
	if successURL == "" {
		return nil, fmt.Errorf("YOOKASSA_SUCCESS_URL is required")
	}

	failURL := os.Getenv("YOOKASSA_FAIL_URL")
	if failURL == "" {
		return nil, fmt.Errorf("YOOKASSA_FAIL_URL is required")
	}

	webhookURL := os.Getenv("YOOKASSA_WEBHOOK_URL")
	if webhookURL == "" {
		return nil, fmt.Errorf("YOOKASSA_WEBHOOK_URL is required")
	}

	adminApiKey := os.Getenv("ADMIN_API_KEY")
	if adminApiKey == "" {
		return nil, fmt.Errorf("ADMIN_API_KEY is rquired for admin endpoints")
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	frontendSuccessPath := os.Getenv("FRONTEND_PAYMENT_SUCCESS_PATH")
	if frontendSuccessPath == "" {
		frontendSuccessPath = "/payment-success.html"
	}

	frontendFailPath := os.Getenv("FRONTEND_PAYMENT_FAIL_PATH")
	if frontendFailPath == "" {
		frontendFailPath = "/payment-fail.html"
	}

	return &Config{
		ServerPort:  serverPort,
		DatabaseURL: databaseURL,
		RedisURL:    redisURL,
		JWT: JWTConfig{
			Secret:  jwtSecret,
			Expires: expires,
		},
		YooKassa: YooKassaConfig{
			ShopID:     shopID,
			SecretKey:  secretKey,
			SuccessURL: successURL,
			FailURL:    failURL,
			WebhookURL: webhookURL,
		},
		ApiKey: ApiKeyConfig{
			Admin: adminApiKey,
		},
		Frontend: FrontendConfig{
			BaseURL:            frontendURL,
			PaymentSuccessPath: frontendSuccessPath,
			PaymentFailPath:    frontendFailPath,
		},
	}, nil
}
