package models

import "time"

type Order struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	Status      string    `json:"status"`
	TotalAmount float64   `json:"total_amount"`
	PaymentID   string    `json:"-"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type OrderItem struct {
	ID              int64   `json:"id"`
	OrderID         int64   `json:"-"`
	ProductID       int64   `json:"product_id"`
	Quantity        int     `json:"quantity"`
	PriceAtPurchase float64 `json:"price_at_purchase"`
}

type OrderResponseItem struct {
	ProductID   int64   `json:"product_id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Quantity    int     `json:"quantity"`
	Subtotal    float64 `json:"subtotal"`
}

type OrderResponse struct {
	ID          int64               `json:"id"`
	Status      string              `json:"status"`
	TotalAmount float64             `json:"total_amount"`
	PaymentID   string              `json:"-"`
	Items       []OrderResponseItem `json:"items"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`
}

type CreateOrderResponse struct {
	OrderID     int64   `json:"order_id"`
	Status      string  `json:"status"`
	TotalAmount float64 `json:"total_amount"`
	PaymentURL  string  `json:"payment_url"`
	Message     string  `json:"message"`
}
