package models

import "time"

type Product struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	Inventory   int       `json:"inventory"`
	ImageURL    string    `json:"image_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	Price       float64 `json:"price" binding:"required,gt=0"`
	Inventory   int     `json:"inventory" binding:"gte=0"`
	ImageURL    string  `json:"image_url"`
}

type UpdateProductRequest struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Price       *float64 `json:"price"`
	Inventory   *int     `json:"inventory"`
	ImageURL    *string  `json:"image_url"`
}

func (r *UpdateProductRequest) HasChanges() bool {
	if r == nil {
		return false
	}

	return r.Name != nil ||
		r.Description != nil ||
		r.Price != nil ||
		r.Inventory != nil ||
		r.ImageURL != nil
}
