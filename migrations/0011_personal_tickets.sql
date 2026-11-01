CREATE TABLE participant_ticket_access (
 registration_id TEXT PRIMARY KEY REFERENCES registrations(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 token_cipher TEXT NOT NULL,
 ticket_hash TEXT NOT NULL,
 recipient TEXT NOT NULL,
 revoked_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE participant_email_changes (
 id TEXT PRIMARY KEY,
 registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES user(id),
 token_hash TEXT NOT NULL UNIQUE,
 old_email TEXT NOT NULL,
 new_email TEXT NOT NULL,
 ticket_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 confirmed_at INTEGER
);
CREATE INDEX email_changes_registration ON participant_email_changes(registration_id,status);
CREATE TRIGGER ticket_access_identity_changed AFTER UPDATE OF email,ticket ON registrations WHEN NEW.email!=OLD.email OR NEW.ticket!=OLD.ticket BEGIN
 UPDATE participant_ticket_access SET revoked_at=unixepoch() WHERE registration_id=NEW.id;
END;
