package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/redis/go-redis/v9"
)

func NewRedisClient(ctx context.Context, addr string) (*redis.Client, error) {
	var (
		rdb *redis.Client
		err error
	)

	if strings.Contains(addr, "://") {
		var opts *redis.Options
		opts, err = redis.ParseURL(addr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse redis url: %w", err)
		}
		rdb = redis.NewClient(opts)
	} else {
		rdb = redis.NewClient(&redis.Options{
			Addr:     addr,
			Password: "",
			DB:       0,
		})
	}

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return rdb, nil
}
