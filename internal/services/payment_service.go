package services

import (
	"bytes"
	"context"
	"ecommerce-api/internal/config"
	"ecommerce-api/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type PaymentCreateResult struct {
	PaymentID       string
	ConfirmationURL string
	Status          string
}

type PaymentService interface {
	CreatePayment(ctx context.Context, order *models.Order) (*PaymentCreateResult, error)
	GetPaymentStatus(ctx context.Context, paymentID string) (string, error)
}

type paymentService struct {
	cfg config.YooKassaConfig
}

func NewPaymentService(cfg config.YooKassaConfig) PaymentService {
	return &paymentService{cfg: cfg}
}

func (s *paymentService) CreatePayment(ctx context.Context, order *models.Order) (*PaymentCreateResult, error) {
	payload := map[string]interface{}{
		"amount": map[string]interface{}{
			"value":    fmt.Sprintf("%.2f", order.TotalAmount),
			"currency": "RUB",
		},
		"confirmation": map[string]interface{}{
			"type":       "redirect",
			"return_url": buildPaymentReturnURL(s.cfg.SuccessURL, order.ID),
		},
		"capture":     true,
		"description": fmt.Sprintf("Order #%d", order.ID),
		"metadata": map[string]interface{}{
			"order_id": fmt.Sprintf("%d", order.ID),
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("json marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.yookassa.ru/v3/payments", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.doRequest(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("yookassa error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		ID           string `json:"id"`
		Confirmation struct {
			Type            string `json:"type"`
			ConfirmationURL string `json:"confirmation_url"`
		} `json:"confirmation"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("json decode failed: %w", err)
	}

	if result.Confirmation.Type != "redirect" {
		return nil, fmt.Errorf("unexpected confirmation type: %s", result.Confirmation.Type)
	}

	return &PaymentCreateResult{
		PaymentID:       result.ID,
		ConfirmationURL: result.Confirmation.ConfirmationURL,
		Status:          result.Status,
	}, nil
}

func (s *paymentService) GetPaymentStatus(ctx context.Context, paymentID string) (string, error) {
	if paymentID == "" {
		return "", fmt.Errorf("payment id is empty")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.yookassa.ru/v3/payments/"+paymentID, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.doRequest(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("yookassa error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("json decode failed: %w", err)
	}

	if result.Status == "" {
		return "", fmt.Errorf("empty payment status for payment %s", paymentID)
	}

	return result.Status, nil
}

func (s *paymentService) doRequest(req *http.Request) (*http.Response, error) {
	req.SetBasicAuth(s.cfg.ShopID, s.cfg.SecretKey)
	req.Header.Set("Content-Type", "application/json")
	if req.Method == http.MethodPost {
		req.Header.Set("Idempotence-Key", fmt.Sprintf("%d", time.Now().UnixNano()))
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	return resp, nil
}

func buildPaymentReturnURL(baseURL string, orderID int64) string {
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		return baseURL
	}

	query := parsedURL.Query()
	query.Set("order_id", strconv.FormatInt(orderID, 10))
	parsedURL.RawQuery = query.Encode()

	return parsedURL.String()
}
