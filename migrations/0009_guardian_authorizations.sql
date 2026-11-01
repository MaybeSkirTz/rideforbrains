CREATE TABLE guardian_requests (
 id TEXT PRIMARY KEY,
 child_user_id TEXT NOT NULL REFERENCES user(id),
 guardian_email TEXT NOT NULL COLLATE NOCASE,
 activity_id TEXT NOT NULL REFERENCES activities(id),
 payload TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 terms_version TEXT NOT NULL,
 terms_snapshot TEXT NOT NULL,
 activity_snapshot TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','cancelled')),
 guardian_user_id TEXT REFERENCES user(id),
 consent_snapshot TEXT,
 decided_at INTEGER,
 expires_at INTEGER NOT NULL,
 used_order_id TEXT REFERENCES orders(id),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX guardian_inbox ON guardian_requests(guardian_email,status,created_at);
CREATE INDEX guardian_child ON guardian_requests(child_user_id,created_at);
ALTER TABLE registrations ADD COLUMN is_minor INTEGER NOT NULL DEFAULT 0 CHECK(is_minor IN (0,1));
ALTER TABLE registrations ADD COLUMN guardian_request_id TEXT REFERENCES guardian_requests(id);
ALTER TABLE registrations ADD COLUMN guardian_snapshot TEXT;
CREATE UNIQUE INDEX registration_guardian_request ON registrations(guardian_request_id) WHERE guardian_request_id IS NOT NULL;
CREATE TRIGGER minor_registration_insert BEFORE INSERT ON registrations WHEN NEW.is_minor=1 BEGIN
 SELECT CASE WHEN (SELECT sport FROM activities WHERE id=NEW.activity_id)='velo' THEN RAISE(ABORT,'ACTIVITY_AGE_RESTRICTED') END;
 SELECT CASE WHEN NEW.status!='waitlisted' AND NOT EXISTS(SELECT 1 FROM guardian_requests g JOIN orders o ON o.id=NEW.order_id WHERE g.id=NEW.guardian_request_id AND g.status='approved' AND g.guardian_user_id IS NOT NULL AND g.guardian_user_id!=g.child_user_id AND g.child_user_id=o.user_id AND g.used_order_id=o.id AND g.activity_id=NEW.activity_id AND g.terms_version=NEW.conditions_version AND NEW.guardian_snapshot IS NOT NULL) THEN RAISE(ABORT,'GUARDIAN_AUTH_REQUIRED') END;
END;
CREATE TRIGGER minor_registration_update BEFORE UPDATE OF status ON registrations WHEN NEW.is_minor=1 AND NEW.status IN ('pending','confirmed','refunding','partially_refunded') BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM guardian_requests g WHERE g.id=NEW.guardian_request_id AND g.status='approved' AND g.used_order_id=NEW.order_id AND g.consent_snapshot IS NOT NULL) THEN RAISE(ABORT,'GUARDIAN_AUTH_REQUIRED') END;
END;
CREATE TRIGGER minor_identity_lock BEFORE UPDATE OF first_name,last_name,activity_id ON registrations WHEN OLD.is_minor=1 AND (NEW.first_name!=OLD.first_name OR NEW.last_name!=OLD.last_name OR NEW.activity_id!=OLD.activity_id) BEGIN
 SELECT RAISE(ABORT,'GUARDIAN_IDENTITY_LOCKED');
END;
UPDATE settings SET data=json_set(data,
 '$.minimumAge',0,
 '$.terms',replace(replace(json_extract(data,'$.terms'),'Participation réservée aux personnes de 18 ans et plus.','Vélo : 18 ans et plus. Course et marche : tous les âges.'),'La participation est réservée aux personnes de 18 ans et plus.','Vélo : 18 ans et plus. Course et marche : tous les âges.')||char(10)||char(10)||'Toute inscription d’un mineur à la course ou à la marche nécessite l’autorisation préalable d’un parent ou tuteur légal majeur depuis un compte distinct. Aucune réservation, confirmation ou demande de paiement n’est créée avant cette autorisation.',
 '$.termsVersion','2026-10-31-parental-v1',
 '$.privacy',json_extract(data,'$.privacy')||char(10)||char(10)||'Pour une inscription de mineur, les renseignements de participation et les conditions sont présentés au parent ou tuteur désigné, connecté à son propre compte vérifié. L’autorisation, son auteur et sa date sont conservés avec le dossier.'
),revision=revision+1 WHERE id=1;
UPDATE settings SET data=json_set(data,'$.faq',json((SELECT json_group_array(json(CASE WHEN json_extract(value,'$.a')='La participation est réservée aux personnes de 18 ans et plus.' THEN json_set(value,'$.a','Le vélo est réservé aux 18 ans et plus. La course et la marche sont ouvertes à tous les âges. Un parent ou tuteur doit autoriser les participants mineurs depuis un compte distinct.') ELSE value END)) FROM json_each(settings.data,'$.faq')))) WHERE id=1;
UPDATE settings SET data=json_set(data,'$.terms',replace(json_extract(data,'$.terms'),'Les dons faits directement à Brain Canada sont distincts des inscriptions.','Les dons faits sur la page de collecte Ride For Brains, hébergée sur la plateforme officielle de collecte de fonds de Brain Canada, sont distincts des inscriptions.')) WHERE id=1;
