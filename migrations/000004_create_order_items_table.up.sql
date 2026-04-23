CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_purchase NUMERIC(10,2) NOT NULL CHECK (price_at_purchase >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
    ON order_items(product_id);
