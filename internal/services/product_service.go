package services

import (
	"context"
	"ecommerce-api/internal/models"
	"ecommerce-api/internal/repositories"
	"errors"
)

var ErrProductNotFound = errors.New("product not found")

type ProductService interface {
	CreateProduct(ctx context.Context, req *models.CreateProductRequest) (int64, error)
	GetProducts(ctx context.Context) ([]*models.Product, error)
	UpdateProduct(ctx context.Context, productID int64, req *models.UpdateProductRequest) error
}

type productService struct {
	repo repositories.ProductRepository
}

func NewProductService(repo repositories.ProductRepository) ProductService {
	return &productService{
		repo: repo,
	}
}

func (ps *productService) CreateProduct(ctx context.Context, req *models.CreateProductRequest) (int64, error) {
	return ps.repo.Create(ctx, req)
}

func (ps *productService) GetProducts(ctx context.Context) ([]*models.Product, error) {
	return ps.repo.List(ctx)
}

func (ps *productService) UpdateProduct(ctx context.Context, productID int64, req *models.UpdateProductRequest) error {
	updated, err := ps.repo.Update(ctx, productID, req)
	if err != nil {
		return err
	}

	if !updated {
		return ErrProductNotFound
	}

	return nil
}
