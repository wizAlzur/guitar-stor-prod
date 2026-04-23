package repositories

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

type CartRepository interface {
	AddItem(ctx context.Context, userID int64, productID int64, quantity int) error
	UpdateItem(ctx context.Context, userID int64, productID int64, quantity int) error
	RemoveItem(ctx context.Context, userID int64, productID int64) error
	GetCart(ctx context.Context, userID int64) (map[int64]int, error)
	ClearCart(ctx context.Context, userID int64) error
}

type cartRepository struct {
	rdb *redis.Client
}

var ErrCartStorageUnavailable = errors.New("cart storage is unavailable")

func NewCartRepository(rdb *redis.Client) CartRepository {
	return &cartRepository{rdb: rdb}
}

func (r *cartRepository) getCartKey(userID int64) string {
	return fmt.Sprintf("cart:%d", userID)
}

func (r *cartRepository) setTTL(ctx context.Context, key string) error {
	if err := r.ensureClient(); err != nil {
		return err
	}

	return r.rdb.Expire(ctx, key, 7*24*time.Hour).Err()
}

func (r *cartRepository) AddItem(ctx context.Context, userID int64, productID int64, quantity int) error {
	if err := r.ensureClient(); err != nil {
		return err
	}

	key := r.getCartKey(userID)
	field := strconv.Itoa(int(productID))

	if err := r.rdb.HIncrBy(ctx, key, field, int64(quantity)).Err(); err != nil {
		return err
	}
	return r.setTTL(ctx, key)
}

func (r *cartRepository) UpdateItem(ctx context.Context, userID int64, productID int64, quantity int) error {
	if err := r.ensureClient(); err != nil {
		return err
	}

	key := r.getCartKey(userID)
	field := strconv.Itoa(int(productID))
	if quantity <= 0 {
		return r.RemoveItem(ctx, userID, productID)
	}

	if err := r.rdb.HSet(ctx, key, field, quantity).Err(); err != nil {
		return err
	}

	return r.setTTL(ctx, key)
}

func (r *cartRepository) RemoveItem(ctx context.Context, userID int64, productID int64) error {
	if err := r.ensureClient(); err != nil {
		return err
	}

	key := r.getCartKey(userID)
	field := strconv.Itoa(int(productID))
	if err := r.rdb.HDel(ctx, key, field).Err(); err != nil {
		return err
	}

	return r.setTTL(ctx, key)
}

func (r *cartRepository) GetCart(ctx context.Context, userID int64) (map[int64]int, error) {
	if err := r.ensureClient(); err != nil {
		return nil, err
	}

	key := r.getCartKey(userID)
	data, err := r.rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	cart := make(map[int64]int)
	for field, val := range data {
		productID, err := strconv.ParseInt(field, 10, 64)
		if err != nil {
			return nil, err
		}
		quantity, err := strconv.Atoi(val)
		if err != nil {
			return nil, err
		}
		cart[productID] = quantity
	}
	r.setTTL(ctx, key)
	return cart, nil
}

func (r *cartRepository) ClearCart(ctx context.Context, userID int64) error {
	if err := r.ensureClient(); err != nil {
		return err
	}

	key := r.getCartKey(userID)
	return r.rdb.Del(ctx, key).Err()
}

func (r *cartRepository) ensureClient() error {
	if r == nil || r.rdb == nil {
		return ErrCartStorageUnavailable
	}

	return nil
}
