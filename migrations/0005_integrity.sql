ALTER TABLE orders ADD COLUMN event_snapshot TEXT NOT NULL DEFAULT '{}';
ALTER TABLE registrations ADD COLUMN activity_snapshot TEXT NOT NULL DEFAULT '{}';
CREATE TABLE drafts (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TRIGGER capacity_reduction BEFORE UPDATE OF capacity ON activities WHEN NEW.capacity IS NOT NULL BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM registrations WHERE activity_id=NEW.id AND (status IN ('confirmed','partially_refunded','refunding') OR (status='pending' AND expires_at>unixepoch()))) > NEW.capacity THEN RAISE(ABORT,'CAPACITY_EXCEEDED') END;
END;
CREATE TRIGGER promo_confirmation_limit BEFORE UPDATE OF status ON orders WHEN NEW.promo IS NOT NULL AND NEW.status='confirmed' AND OLD.status IN ('pending','failed','expired') BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM promos WHERE code=NEW.promo AND max_uses IS NOT NULL AND max_uses<=(SELECT COUNT(*) FROM orders WHERE id!=NEW.id AND promo=NEW.promo AND (status IN ('confirmed','paid_review','refunding','partially_refunded','refunded') OR (status='pending' AND expires_at>unixepoch())))) THEN RAISE(ABORT,'PROMO_UNAVAILABLE') END;
END;
