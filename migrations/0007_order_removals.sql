ALTER TABLE orders ADD COLUMN removed_at INTEGER;
ALTER TABLE orders ADD COLUMN removed_by TEXT;
ALTER TABLE registrations ADD COLUMN removed_at INTEGER;
CREATE INDEX orders_removed ON orders(removed_at,created_at);
CREATE INDEX registrations_removed ON registrations(removed_at,order_id);
CREATE TABLE order_removals (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),
 id TEXT NOT NULL UNIQUE,
 actor_id TEXT NOT NULL REFERENCES user(id),
 reason TEXT NOT NULL,
 refund_eligible INTEGER NOT NULL,
 refund_amount INTEGER NOT NULL,
 checkout_closed INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE VIEW visible_orders AS SELECT * FROM orders WHERE removed_at IS NULL;
CREATE VIEW visible_registrations AS SELECT r.* FROM registrations r JOIN orders o ON o.id=r.order_id WHERE o.removed_at IS NULL AND r.removed_at IS NULL;
CREATE TRIGGER order_removed AFTER UPDATE OF removed_at ON orders WHEN NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL BEGIN
 UPDATE registrations SET removed_at=NEW.removed_at,status=CASE WHEN status='refunded' THEN 'refunded' ELSE 'cancelled' END WHERE order_id=NEW.id;
 UPDATE registration_transfers SET status='cancelled' WHERE status='pending' AND registration_id IN (SELECT id FROM registrations WHERE order_id=NEW.id);
 UPDATE outbox SET status='cancelled',error='Commande retirée par un administrateur' WHERE status IN ('queued','retry') AND registration_id IN (SELECT id FROM registrations WHERE order_id=NEW.id);
END;
CREATE TRIGGER removed_registration_status AFTER UPDATE OF status ON registrations WHEN NEW.removed_at IS NOT NULL AND NEW.status NOT IN ('cancelled','refunded') BEGIN
 UPDATE registrations SET status='cancelled' WHERE id=NEW.id;
END;
CREATE TRIGGER removed_order_no_new_registration BEFORE INSERT ON registrations WHEN EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND removed_at IS NOT NULL) BEGIN
 SELECT RAISE(ABORT,'ORDER_REMOVED');
END;
DROP TRIGGER promo_limit;
CREATE TRIGGER promo_limit BEFORE INSERT ON orders WHEN NEW.promo IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM promos WHERE code=NEW.promo AND active=1 AND (expires_at IS NULL OR expires_at>unixepoch()) AND (max_uses IS NULL OR max_uses>(SELECT COUNT(*) FROM visible_orders WHERE promo=NEW.promo AND (status IN ('confirmed','paid_review','refunding','partially_refunded','refunded') OR (status='pending' AND expires_at>unixepoch()))))) THEN RAISE(ABORT,'PROMO_UNAVAILABLE') END;
END;
DROP TRIGGER promo_confirmation_limit;
CREATE TRIGGER promo_confirmation_limit BEFORE UPDATE OF status ON orders WHEN NEW.promo IS NOT NULL AND NEW.status='confirmed' AND OLD.status IN ('pending','failed','expired') BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM promos WHERE code=NEW.promo AND max_uses IS NOT NULL AND max_uses<=(SELECT COUNT(*) FROM visible_orders WHERE id!=NEW.id AND promo=NEW.promo AND (status IN ('confirmed','paid_review','refunding','partially_refunded','refunded') OR (status='pending' AND expires_at>unixepoch())))) THEN RAISE(ABORT,'PROMO_UNAVAILABLE') END;
END;
