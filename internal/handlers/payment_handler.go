package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"

	"ecommerce-api/internal/services"

	"github.com/gin-gonic/gin"
)

type PaymentHandler struct {
	orderService services.OrderService
}

func NewPaymentHandler(orderService services.OrderService) *PaymentHandler {
	return &PaymentHandler{orderService: orderService}
}

var yookassaAllowedCIDRs = []string{
	"185.71.76.0/27",
	"185.71.77.0/27",
	"77.75.153.0/25",
	"77.75.156.11",
	"77.75.156.35",
	"77.75.154.128/25",
	"2a02:5180::/32",
}

func (h *PaymentHandler) HandleWebhook(c *gin.Context) {
	clientIP := c.ClientIP()
	if !isIPAllowed(clientIP, yookassaAllowedCIDRs) {
		log.Printf("Webhook: blocked from unauthorized IP %s", clientIP)
		c.Status(http.StatusForbidden)
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("Webhook read body error: %v", err)
		c.Status(http.StatusBadRequest)
		return
	}

	var payload struct {
		Type   string `json:"type"`
		Event  string `json:"event"`
		Object struct {
			ID       string `json:"id"`
			Status   string `json:"status"`
			Metadata struct {
				OrderID string `json:"order_id"`
			} `json:"metadata"`
		} `json:"object"`
	}

	if err := json.Unmarshal(body, &payload); err != nil {
		log.Printf("Webhook json error: %v", err)
		c.Status(http.StatusBadRequest)
		return
	}

	if payload.Type == "notification" {
		switch payload.Event {
		case "payment.succeeded":
			orderIDStr := payload.Object.Metadata.OrderID
			orderID, err := strconv.ParseInt(orderIDStr, 10, 64)
			if err != nil || orderID == 0 {
				log.Printf("Webhook: invalid order_id: %s", orderIDStr)
				c.Status(http.StatusBadRequest)
				return
			}

			ctx := c.Request.Context()
			if err := h.orderService.UpdateOrderStatus(ctx, orderID, "paid"); err != nil {
				log.Printf("Webhook: failed to update order %d: %v", orderID, err)
				c.Status(http.StatusInternalServerError)
				return
			}

			log.Printf("Webhook: order %d updated to paid", orderID)

		case "payment.canceled":
			orderIDStr := payload.Object.Metadata.OrderID
			orderID, _ := strconv.ParseInt(orderIDStr, 10, 64)
			if orderID != 0 {
				ctx := c.Request.Context()
				_ = h.orderService.UpdateOrderStatus(ctx, orderID, "canceled")
				log.Printf("Webhook: order %d canceled", orderID)
			}

		default:
			log.Printf("Webhook: unhandled event: %s", payload.Event)
		}
	}

	c.Status(http.StatusOK)
}

func isIPAllowed(ipStr string, cidrs []string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	for _, cidr := range cidrs {
		if strings.Contains(cidr, "/") {
			_, network, err := net.ParseCIDR(cidr)
			if err == nil && network.Contains(ip) {
				return true
			}
			continue
		}

		allowedIP := net.ParseIP(cidr)
		if allowedIP != nil && allowedIP.Equal(ip) {
			return true
		}
	}
	return false
}
