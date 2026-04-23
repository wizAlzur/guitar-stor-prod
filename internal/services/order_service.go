package services

import (
	"context"
	"ecommerce-api/internal/models"
	"ecommerce-api/internal/repositories"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OrderService interface {
	CreateOrder(ctx context.Context, userID int64) (*models.CreateOrderResponse, error)
	ListOrders(ctx context.Context, userID int64) ([]*models.OrderResponse, error)
	GetOrderByID(ctx context.Context, orderID int64, userID int64) (*models.OrderResponse, error)
	UpdateOrderStatus(ctx context.Context, orderID int64, newStatus string) error
}

type orderService struct {
	pool        *pgxpool.Pool
	productRepo repositories.ProductRepository
	cartRepo    repositories.CartRepository
	orderRepo   repositories.OrderRepository
	paymentSvc  PaymentService
}

func NewOrderService(
	pool *pgxpool.Pool,
	productRepo repositories.ProductRepository,
	cartRepo repositories.CartRepository,
	orderRepo repositories.OrderRepository,
	paymentSvc PaymentService,
) OrderService {
	return &orderService{
		pool:        pool,
		productRepo: productRepo,
		cartRepo:    cartRepo,
		orderRepo:   orderRepo,
		paymentSvc:  paymentSvc,
	}
}

func (s *orderService) CreateOrder(ctx context.Context, userID int64) (*models.CreateOrderResponse, error) {
	cartMap, err := s.cartRepo.GetCart(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get cart: %w", err)
	}

	if len(cartMap) == 0 {
		return nil, fmt.Errorf("cart is empty")
	}

	productIDs := make([]int64, 0, len(cartMap))
	for id := range cartMap {
		productIDs = append(productIDs, id)
	}

	products, err := s.productRepo.GetByIDs(ctx, productIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get products: %w", err)
	}

	productMap := make(map[int64]*models.Product)
	for _, p := range products {
		productMap[p.ID] = p
	}

	var total float64
	items := make([]models.OrderItem, 0, len(cartMap))
	for productID, quantity := range cartMap {
		product, ok := productMap[productID]
		if !ok {
			return nil, fmt.Errorf("product %d not found", productID)
		}

		if quantity > product.Inventory {
			return nil, fmt.Errorf("not enough inventory for product %d: need %d, available %d", productID, quantity, product.Inventory)
		}

		subtotal := float64(quantity) * product.Price
		total += subtotal

		items = append(items, models.OrderItem{
			ProductID:       productID,
			Quantity:        quantity,
			PriceAtPurchase: product.Price,
		})
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	for _, item := range items {
		updateQuery := `
			UPDATE products
			SET inventory = inventory - $1
			WHERE id = $2 AND inventory >= $1`

		result, err := tx.Exec(ctx, updateQuery, item.Quantity, item.ProductID)
		if err != nil {
			tx.Rollback(ctx)
			return nil, fmt.Errorf("failed to update inventory for product %d: %w", item.ProductID, err)
		}

		if result.RowsAffected() == 0 {
			tx.Rollback(ctx)
			return nil, fmt.Errorf("not enough inventory for product %d (concurrent modification or insufficient stock)", item.ProductID)
		}
	}

	order := &models.Order{
		UserID:      userID,
		Status:      "pending",
		TotalAmount: total,
	}

	if err := s.orderRepo.CreateOrder(ctx, tx, order, items); err != nil {
		tx.Rollback(ctx)
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	if err := s.cartRepo.ClearCart(ctx, userID); err != nil {
		log.Printf("warning: failed to clear cart for user %d: %v", userID, err)
	}

	var paymentURL string
	paymentResult, err := s.paymentSvc.CreatePayment(ctx, order)
	if err != nil {
		log.Printf("warning: failed to create payment for order %d: %v", order.ID, err)
	} else {
		paymentURL = paymentResult.ConfirmationURL
		order.PaymentID = paymentResult.PaymentID

		if order.PaymentID != "" {
			if err := s.orderRepo.UpdateOrderPaymentID(ctx, order.ID, order.PaymentID); err != nil {
				log.Printf("warning: failed to save payment id for order %d: %v", order.ID, err)
			}
		}

		if syncedStatus := mapYooKassaStatusToOrderStatus(paymentResult.Status); syncedStatus != "" && syncedStatus != order.Status {
			if err := s.orderRepo.UpdateOrderStatus(ctx, order.ID, syncedStatus); err != nil {
				log.Printf("warning: failed to apply initial payment status for order %d: %v", order.ID, err)
			} else {
				order.Status = syncedStatus
			}
		}
	}

	return &models.CreateOrderResponse{
		OrderID:     order.ID,
		Status:      order.Status,
		TotalAmount: total,
		PaymentURL:  paymentURL,
		Message:     "order created",
	}, nil
}

func (s *orderService) ListOrders(ctx context.Context, userID int64) ([]*models.OrderResponse, error) {
	orders, err := s.orderRepo.ListOrders(ctx, userID)
	if err != nil {
		return nil, err
	}

	for _, order := range orders {
		if _, err := s.syncOrderStatusFromPayment(ctx, order); err != nil {
			log.Printf("warning: failed to sync order %d payment status: %v", order.ID, err)
		}
	}

	return orders, nil
}

func (s *orderService) GetOrderByID(ctx context.Context, orderID int64, userID int64) (*models.OrderResponse, error) {
	order, err := s.orderRepo.GetOrderByID(ctx, orderID, userID)
	if err != nil {
		return nil, err
	}

	changed, err := s.syncOrderStatusFromPayment(ctx, order)
	if err != nil {
		log.Printf("warning: failed to sync order %d payment status: %v", orderID, err)
		return order, nil
	}

	if !changed {
		return order, nil
	}

	updatedOrder, err := s.orderRepo.GetOrderByID(ctx, orderID, userID)
	if err != nil {
		log.Printf("warning: failed to reload order %d after status sync: %v", orderID, err)
		return order, nil
	}

	return updatedOrder, nil
}

func (s *orderService) UpdateOrderStatus(ctx context.Context, orderID int64, newStatus string) error {
	return s.orderRepo.UpdateOrderStatus(ctx, orderID, newStatus)
}

func (s *orderService) syncOrderStatusFromPayment(ctx context.Context, order *models.OrderResponse) (bool, error) {
	if order == nil || order.Status != "pending" || order.PaymentID == "" {
		return false, nil
	}

	paymentStatus, err := s.paymentSvc.GetPaymentStatus(ctx, order.PaymentID)
	if err != nil {
		return false, err
	}

	newStatus := mapYooKassaStatusToOrderStatus(paymentStatus)
	if newStatus == "" || newStatus == order.Status {
		return false, nil
	}

	if err := s.orderRepo.UpdateOrderStatus(ctx, order.ID, newStatus); err != nil {
		return false, err
	}

	order.Status = newStatus
	return true, nil
}

func mapYooKassaStatusToOrderStatus(status string) string {
	switch status {
	case "succeeded":
		return "paid"
	case "canceled":
		return "canceled"
	case "pending", "waiting_for_capture":
		return "pending"
	default:
		return ""
	}
}
