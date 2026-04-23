ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_id
ON orders (payment_id)
WHERE payment_id IS NOT NULL;