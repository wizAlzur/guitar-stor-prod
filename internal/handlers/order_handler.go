package handlers

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"ecommerce-api/internal/config"
	"ecommerce-api/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type OrderHandler struct {
	service  services.OrderService
	frontend config.FrontendConfig
}

func NewOrderHandler(service services.OrderService, frontend config.FrontendConfig) *OrderHandler {
	return &OrderHandler{
		service:  service,
		frontend: frontend,
	}
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	userID := getUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ctx := c.Request.Context()
	resp, err := h.service.CreateOrder(ctx, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *OrderHandler) ListOrders(c *gin.Context) {
	userID := getUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ctx := c.Request.Context()
	orders, err := h.service.ListOrders(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}

func (h *OrderHandler) GetOrder(c *gin.Context) {
	userID := getUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	orderIDStr := c.Param("id")
	orderID, err := strconv.ParseInt(orderIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}

	ctx := c.Request.Context()
	order, err := h.service.GetOrderByID(ctx, orderID, userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, order)
}

func (h *OrderHandler) PaymentSuccess(c *gin.Context) {
	c.Redirect(http.StatusFound, h.buildFrontendRedirectURL(c, h.frontend.PaymentSuccessPath))
}

func (h *OrderHandler) PaymentFail(c *gin.Context) {
	c.Redirect(http.StatusFound, h.buildFrontendRedirectURL(c, h.frontend.PaymentFailPath))
}

func (h *OrderHandler) buildFrontendRedirectURL(c *gin.Context, path string) string {
	target := strings.TrimRight(h.frontend.BaseURL, "/")
	relativePath := strings.TrimLeft(path, "/")
	if relativePath != "" {
		target += "/" + relativePath
	}

	if query := c.Request.URL.RawQuery; query != "" {
		target += "?" + query
	}

	if _, err := url.ParseRequestURI(target); err != nil {
		return h.frontend.BaseURL
	}

	return target
}
