package repositories

import (
	"context"
	"ecommerce-api/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ProductRepository interface {
	Create(ctx context.Context, req *models.CreateProductRequest) (int64, error)
	List(ctx context.Context) ([]*models.Product, error)
	GetByIDs(ctx context.Context, ids []int64) ([]*models.Product, error)
	Update(ctx context.Context, productID int64, req *models.UpdateProductRequest) (bool, error)
}

type productRepository struct {
	pool *pgxpool.Pool
}

func (r *productRepository) Create(ctx context.Context, req *models.CreateProductRequest) (int64, error) {
	var id int64
	err := r.pool.QueryRow(ctx, `
        INSERT INTO products (name, description, price, inventory, image_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
		req.Name, req.Description, req.Price, req.Inventory, emptyStringToNil(req.ImageURL)).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (r *productRepository) List(ctx context.Context) ([]*models.Product, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, description, price, inventory, COALESCE(image_url, ''), created_at, updated_at
		FROM products
		ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]*models.Product, 0)
	for rows.Next() {
		p := &models.Product{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Inventory, &p.ImageURL, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return products, nil
}

func (r *productRepository) GetByIDs(ctx context.Context, ids []int64) ([]*models.Product, error) {
	if len(ids) == 0 {
		return []*models.Product{}, nil
	}

	query := `
		SELECT id, name, description, price, inventory, COALESCE(image_url, ''), created_at, updated_at
		FROM products
		WHERE id = ANY($1)
		ORDER BY id`

	rows, err := r.pool.Query(ctx, query, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*models.Product
	for rows.Next() {
		p := &models.Product{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Inventory, &p.ImageURL, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return products, nil
}

func (r *productRepository) Update(ctx context.Context, productID int64, req *models.UpdateProductRequest) (bool, error) {
	result, err := r.pool.Exec(ctx, `
		UPDATE products
		SET name = COALESCE($1, name),
			description = COALESCE($2, description),
			price = COALESCE($3, price),
			inventory = COALESCE($4, inventory),
			image_url = COALESCE($5, image_url),
			updated_at = NOW()
		WHERE id = $6`,
		req.Name,
		emptyOptionalString(req.Description),
		req.Price,
		req.Inventory,
		emptyOptionalString(req.ImageURL),
		productID,
	)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
}

func NewProductRepository(pool *pgxpool.Pool) ProductRepository {
	return &productRepository{pool: pool}
}

func emptyStringToNil(value string) *string {
	if value == "" {
		return nil
	}

	return &value
}

func emptyOptionalString(value *string) *string {
	if value == nil {
		return nil
	}

	if *value == "" {
		empty := ""
		return &empty
	}

	return value
}
