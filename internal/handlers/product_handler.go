package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"ecommerce-api/internal/models"
	"ecommerce-api/internal/services"

	"github.com/gin-gonic/gin"
)

type ProductHandler struct {
	service services.ProductService
}

func NewProductHandler(service services.ProductService) *ProductHandler {
	return &ProductHandler{service: service}
}

func (ph *ProductHandler) Create(c *gin.Context) {
	var req models.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	normalizeCreateProductRequest(&req)
	if err := validateCreateProductRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	id, err := ph.service.CreateProduct(ctx, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "created"})
}

func (ph *ProductHandler) Update(c *gin.Context) {
	productID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || productID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
		return
	}

	var req models.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	normalizeUpdateProductRequest(&req)
	if err := validateUpdateProductRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	if err := ph.service.UpdateProduct(ctx, productID, &req); err != nil {
		if errors.Is(err, services.ErrProductNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (ph *ProductHandler) List(c *gin.Context) {
	ctx := c.Request.Context()
	products, err := ph.service.GetProducts(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, products)
}

func normalizeCreateProductRequest(req *models.CreateProductRequest) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
}

func normalizeUpdateProductRequest(req *models.UpdateProductRequest) {
	if req.Name != nil {
		value := strings.TrimSpace(*req.Name)
		req.Name = &value
	}

	if req.Description != nil {
		value := strings.TrimSpace(*req.Description)
		req.Description = &value
	}

	if req.ImageURL != nil {
		value := strings.TrimSpace(*req.ImageURL)
		req.ImageURL = &value
	}
}

func validateCreateProductRequest(req *models.CreateProductRequest) error {
	if req.Name == "" {
		return errors.New("name is required")
	}

	if req.Price <= 0 {
		return errors.New("price must be greater than zero")
	}

	if req.Inventory < 0 {
		return errors.New("inventory must be greater than or equal to zero")
	}

	return nil
}

func validateUpdateProductRequest(req *models.UpdateProductRequest) error {
	if !req.HasChanges() {
		return errors.New("at least one field is required")
	}

	if req.Name != nil && *req.Name == "" {
		return errors.New("name cannot be empty")
	}

	if req.Price != nil && *req.Price <= 0 {
		return errors.New("price must be greater than zero")
	}

	if req.Inventory != nil && *req.Inventory < 0 {
		return errors.New("inventory must be greater than or equal to zero")
	}

	return nil
}
