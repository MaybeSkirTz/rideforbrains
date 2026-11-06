ALTER TABLE orders ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN (0,1));
UPDATE orders SET is_test=1 WHERE stripe_session GLOB 'cs_test_*';
