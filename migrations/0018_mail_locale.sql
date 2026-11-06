ALTER TABLE outbox ADD COLUMN locale TEXT NOT NULL DEFAULT 'fr-CA'
  CHECK(locale IN ('fr-CA', 'en-CA'));
