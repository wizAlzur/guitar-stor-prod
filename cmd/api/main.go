package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ecommerce-api/internal/config"
	"ecommerce-api/internal/db"
	"ecommerce-api/internal/handlers"
	"ecommerce-api/internal/middlewares"
	"ecommerce-api/internal/repositories"
	"ecommerce-api/internal/server"
	"ecommerce-api/internal/services"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	// PostgreSQL
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	log.Println("connected to postgres")

	// Redis
	rdb, err := db.NewRedisClient(ctx, cfg.RedisURL)
	if err != nil {
		log.Printf("redis unavailable: %v — cart features disabled", err)
		rdb = nil
	} else {
		log.Println("connected to redis")
		defer rdb.Close()
	}

	// Репозитории
	productRepo := repositories.NewProductRepository(pool)
	cartRepo := repositories.NewCartRepository(rdb)
	userRepo := repositories.NewUserRepository(pool)
	orderRepo := repositories.NewOrderRepository(pool)

	// Сервисы
	productService := services.NewProductService(productRepo)
	cartService := services.NewCartService(cartRepo, productRepo)
	authService := services.NewAuthService(userRepo, cfg.JWT)
	paymentService := services.NewPaymentService(cfg.YooKassa)
	orderService := services.NewOrderService(pool, productRepo, cartRepo, orderRepo, paymentService)

	// Хендлеры
	productHandler := handlers.NewProductHandler(productService)
	cartHandler := handlers.NewCartHandler(cartService)
	authHandler := handlers.NewAuthHandler(authService)
	orderHandler := handlers.NewOrderHandler(orderService, cfg.Frontend)
	paymentHandler := handlers.NewPaymentHandler(orderService)

	//Middleware
	authMiddleware := middlewares.Auth(authService)

	// Роутер
	router := server.NewRouter(cfg.ApiKey, cfg.Frontend, productHandler, cartHandler, authHandler, authMiddleware, orderHandler, paymentHandler)

	// Сервер
	srv := &http.Server{
		Addr:    cfg.ServerPort,
		Handler: router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("server error:", err)
		}
	}()
	log.Printf("server running on %s", cfg.ServerPort)

	// Graceful shutdown
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Println("server shutdown error:", err)
	}

	log.Println("shutdown complete")
}
