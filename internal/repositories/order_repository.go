package repositories

import (
	"context"
	"ecommerce-api/internal/models"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OrderRepository interface {
	CreateOrder(ctx context.Context, tx pgx.Tx, order *models.Order, items []models.OrderItem) error
	GetOrderByID(ctx context.Context, orderID int64, userID int64) (*models.OrderResponse, error)
	ListOrders(ctx context.Context, userID int64) ([]*models.OrderResponse, error)
	UpdateOrderStatus(ctx context.Context, orderID int64, newStatus string) error
	UpdateOrderPaymentID(ctx context.Context, orderID int64, paymentID string) error
}

type orderRepository struct {
	pool *pgxpool.Pool
}

func NewOrderRepository(pool *pgxpool.Pool) OrderRepository {
	return &orderRepository{pool: pool}
}

func (r *orderRepository) CreateOrder(ctx context.Context, tx pgx.Tx, order *models.Order, items []models.OrderItem) error {
	queryOrder := `
		INSERT INTO orders (user_id, status, total_amount)
		VALUES ($1, $2, $3)
		RETURNING id`

	err := tx.QueryRow(ctx, queryOrder, order.UserID, order.Status, order.TotalAmount).Scan(&order.ID)
	if err != nil {
		return err
	}

	queryItem := `
		INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
		VALUES ($1, $2, $3, $4)`

	for i := range items {
		item := &items[i]
		item.OrderID = order.ID
		_, err := tx.Exec(ctx, queryItem, item.OrderID, item.ProductID, item.Quantity, item.PriceAtPurchase)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *orderRepository) GetOrderByID(ctx context.Context, orderID int64, userID int64) (*models.OrderResponse, error) {
	query := `
		SELECT 
			o.id, o.user_id, o.status, o.total_amount, COALESCE(o.payment_id, ''), o.created_at, o.updated_at,
			oi.product_id, oi.quantity, oi.price_at_purchase,
			p.name, p.description, p.price
		FROM orders o
		JOIN order_items oi ON o.id = oi.order_id
		JOIN products p ON oi.product_id = p.id
		WHERE o.id = $1 AND o.user_id = $2
		ORDER BY oi.id`

	rows, err := r.pool.Query(ctx, query, orderID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var response *models.OrderResponse
	var items []models.OrderResponseItem

	for rows.Next() {
		var item models.OrderResponseItem
		var order models.Order
		var dummyPrice float64

		err := rows.Scan(
			&order.ID, &order.UserID, &order.Status, &order.TotalAmount, &order.PaymentID, &order.CreatedAt, &order.UpdatedAt,
			&item.ProductID, &item.Quantity, &item.Price,
			&item.Name, &item.Description, &dummyPrice,
		)
		if err != nil {
			return nil, err
		}

		if response == nil {
			response = &models.OrderResponse{
				ID:          order.ID,
				Status:      order.Status,
				TotalAmount: order.TotalAmount,
				PaymentID:   order.PaymentID,
				CreatedAt:   order.CreatedAt,
				UpdatedAt:   order.UpdatedAt,
				Items:       make([]models.OrderResponseItem, 0),
			}
		}

		item.Subtotal = float64(item.Quantity) * item.Price
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if response == nil {
		return nil, pgx.ErrNoRows
	}

	response.Items = items
	return response, nil
}

func (r *orderRepository) ListOrders(ctx context.Context, userID int64) ([]*models.OrderResponse, error) {
	query := `
		SELECT id, status, total_amount, COALESCE(payment_id, ''), created_at, updated_at
		FROM orders
		WHERE user_id = $1
		ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*models.OrderResponse
	for rows.Next() {
		var o models.OrderResponse
		o.Items = make([]models.OrderResponseItem, 0)
		err := rows.Scan(&o.ID, &o.Status, &o.TotalAmount, &o.PaymentID, &o.CreatedAt, &o.UpdatedAt)
		if err != nil {
			return nil, err
		}
		orders = append(orders, &o)
	}

	return orders, rows.Err()
}

func (r *orderRepository) UpdateOrderStatus(ctx context.Context, orderID int64, newStatus string) error {
	query := `
		UPDATE orders
		SET status = $1,
			updated_at = NOW()
		WHERE id = $2`

	result, err := r.pool.Exec(ctx, query, newStatus, orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("order %d not found or already in final state", orderID)
	}

	return nil
}

func (r *orderRepository) UpdateOrderPaymentID(ctx context.Context, orderID int64, paymentID string) error {
	query := `
		UPDATE orders
		SET payment_id = $1,
			updated_at = NOW()
		WHERE id = $2`

	result, err := r.pool.Exec(ctx, query, paymentID, orderID)
	if err != nil {
		return fmt.Errorf("failed to update order payment id: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("order %d not found", orderID)
	}

	return nil
}
