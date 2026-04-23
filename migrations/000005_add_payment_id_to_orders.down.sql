DROP INDEX IF EXISTS idx_orders_payment_id;

ALTER TABLE orders
DROP COLUMN IF EXISTS payment_id;