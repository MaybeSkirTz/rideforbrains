CREATE TABLE wallet_issues (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('apple','google')),
  ticket_hash TEXT NOT NULL,
  issued_at INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked_at INTEGER,
  provider_notified_at INTEGER,
  UNIQUE(registration_id,provider,ticket_hash)
);
CREATE INDEX wallet_issue_revocations ON wallet_issues(provider,revoked_at,provider_notified_at);
CREATE TRIGGER wallet_revoke_ticket AFTER UPDATE OF ticket,status,removed_at ON registrations
WHEN NEW.ticket<>OLD.ticket OR NEW.status IN ('cancelled','refunded','expired','failed') OR NEW.removed_at IS NOT NULL
BEGIN
  INSERT INTO audit(id,actor,action,target,detail)
    SELECT lower(hex(randomblob(16))),'service:wallet','wallet.revoked',id,json_object('provider',provider)
    FROM wallet_issues WHERE registration_id=NEW.id AND revoked_at IS NULL;
  UPDATE wallet_issues SET revoked_at=unixepoch() WHERE registration_id=NEW.id AND revoked_at IS NULL;
END;
