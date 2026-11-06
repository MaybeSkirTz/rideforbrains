CREATE TABLE important_notices (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES user(id),
  enqueue_token TEXT,
  scheduled_at INTEGER,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

ALTER TABLE outbox ADD COLUMN notice_id TEXT REFERENCES important_notices(id);
ALTER TABLE outbox ADD COLUMN first_attempt_at INTEGER;
CREATE INDEX outbox_notice ON outbox(notice_id,status);
