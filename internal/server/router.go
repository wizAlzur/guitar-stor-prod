package server

import (
	"ecommerce-api/internal/config"
	"ecommerce-api/internal/handlers"
	"ecommerce-api/internal/middlewares"
	"net/http"

	"github.com/gin-gonic/gin"
)

func NewRouter(
	apiKeyConfig config.ApiKeyConfig,
	frontendConfig config.FrontendConfig,
	productHandler *handlers.ProductHandler,
	cartHandler *handlers.CartHandler,
	authHandler *handlers.AuthHandler,
	authMiddleware gin.HandlerFunc,
	orderHandler *handlers.OrderHandler,
	paymentHandler *handlers.PaymentHandler,
) *gin.Engine {
	r := gin.Default()
	r.Use(middlewares.CORS(frontendConfig.BaseURL))
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.POST("/register", authHandler.Register)
	r.POST("/login", authHandler.Login)

	r.POST("/products", middlewares.ApiKeyMiddleware(apiKeyConfig.Admin), productHandler.Create)
	r.PATCH("/products/:id", middlewares.ApiKeyMiddleware(apiKeyConfig.Admin), productHandler.Update)
	r.GET("/products", productHandler.List)

	r.GET("/success", orderHandler.PaymentSuccess)
	r.GET("/fail", orderHandler.PaymentFail)

	r.POST("/webhook/yookassa", paymentHandler.HandleWebhook)

	cart := r.Group("/cart")
	cart.Use(authMiddleware)
	{
		cart.POST("/items", cartHandler.AddToCart)
		cart.PUT("/items/:product_id", cartHandler.UpdateCartItem)
		cart.DELETE("/items/:product_id", cartHandler.RemoveFromCart)
		cart.GET("", cartHandler.GetCart)
		cart.DELETE("", cartHandler.ClearCart)
	}

	orders := r.Group("/orders")
	orders.Use(authMiddleware)
	{
		orders.POST("", orderHandler.CreateOrder)
		orders.GET("", orderHandler.ListOrders)
		orders.GET("/:id", orderHandler.GetOrder)
	}

	return r
}
