CREATE TABLE promo_redemptions (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),
 code TEXT NOT NULL COLLATE NOCASE REFERENCES promos(code),
 redeemed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX promo_redemptions_code ON promo_redemptions(code);
INSERT INTO promo_redemptions(order_id,code) SELECT o.id,o.promo FROM orders o WHERE o.promo IS NOT NULL AND (o.status IN ('confirmed','paid_review','refunding','partially_refunded','refunded') OR o.payment_intent IS NOT NULL OR EXISTS(SELECT 1 FROM registrations r JOIN history h ON h.registration_id=r.id WHERE r.order_id=o.id AND h.status='confirmed'));
CREATE VIEW promo_usage AS SELECT p.*,(SELECT COUNT(*) FROM promo_redemptions r WHERE r.code=p.code) AS redeemed,(SELECT COUNT(*) FROM orders o WHERE o.promo=p.code AND o.removed_at IS NULL AND o.status='pending' AND o.expires_at>unixepoch() AND NOT EXISTS(SELECT 1 FROM promo_redemptions r WHERE r.order_id=o.id)) AS reserved FROM promos p;
UPDATE promos SET active=0 WHERE max_uses IS NOT NULL AND max_uses<=(SELECT COUNT(*) FROM promo_redemptions r WHERE r.code=promos.code);
CREATE TRIGGER promo_redeem_insert AFTER INSERT ON orders WHEN NEW.promo IS NOT NULL AND (NEW.status IN ('confirmed','paid_review','refunding','partially_refunded','refunded') OR NEW.payment_intent IS NOT NULL) BEGIN
 INSERT OR IGNORE INTO promo_redemptions(order_id,code) VALUES(NEW.id,NEW.promo);
 UPDATE promos SET active=0 WHERE code=NEW.promo AND max_uses IS NOT NULL AND max_uses<=(SELECT COUNT(*) FROM promo_redemptions r WHERE r.code=NEW.promo);
END;
CREATE TRIGGER promo_redeem_update AFTER UPDATE OF status,payment_intent ON orders WHEN NEW.promo IS NOT NULL AND (NEW.status IN ('confirmed','paid_review','refunding','partially_refunded','refunded') OR NEW.payment_intent IS NOT NULL) BEGIN
 INSERT OR IGNORE INTO promo_redemptions(order_id,code) VALUES(NEW.id,NEW.promo);
 UPDATE promos SET active=0 WHERE code=NEW.promo AND max_uses IS NOT NULL AND max_uses<=(SELECT COUNT(*) FROM promo_redemptions r WHERE r.code=NEW.promo);
END;
DROP TRIGGER promo_limit;
CREATE TRIGGER promo_limit BEFORE INSERT ON orders WHEN NEW.promo IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM promo_usage WHERE code=NEW.promo AND active=1 AND (expires_at IS NULL OR expires_at>unixepoch()) AND (max_uses IS NULL OR redeemed+reserved<max_uses)) THEN RAISE(ABORT,'PROMO_UNAVAILABLE') END;
END;
DROP TRIGGER promo_confirmation_limit;
CREATE TRIGGER promo_confirmation_limit BEFORE UPDATE OF status ON orders WHEN NEW.promo IS NOT NULL AND NEW.status='confirmed' AND OLD.status IN ('pending','failed','expired') BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM promos p WHERE p.code=NEW.promo AND p.max_uses IS NOT NULL AND p.max_uses<=((SELECT COUNT(*) FROM promo_redemptions r WHERE r.code=NEW.promo AND r.order_id!=NEW.id)+(SELECT COUNT(*) FROM orders o WHERE o.promo=NEW.promo AND o.id!=NEW.id AND o.removed_at IS NULL AND o.status='pending' AND o.expires_at>unixepoch() AND NOT EXISTS(SELECT 1 FROM promo_redemptions r WHERE r.order_id=o.id)))) THEN RAISE(ABORT,'PROMO_UNAVAILABLE') END;
END;
ALTER TABLE registrations ADD COLUMN public_listing INTEGER NOT NULL DEFAULT 0 CHECK(public_listing IN (0,1));
ALTER TABLE registrations ADD COLUMN public_listing_consent TEXT;
UPDATE settings SET data=json_set(data,'$.privacy',json_extract(data,'$.privacy')||char(10)||char(10)||'L’affichage dans la liste publique des participants est facultatif et distinct des photos ou du marketing. Seuls le prénom et l’initiale du nom apparaissent, par activité, pour les participations confirmées ayant donné leur accord. Aucun courriel, téléphone ni âge n’est publié. Pour un mineur, ce choix doit faire partie de l’autorisation parentale. Le retrait est possible depuis l’espace participant.'),revision=revision+1 WHERE id=1;
