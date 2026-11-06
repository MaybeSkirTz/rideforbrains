CREATE TABLE referrals (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE referral_visits (
  code TEXT NOT NULL REFERENCES referrals(code) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  visited_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY(code,visitor_hash)
);
CREATE TABLE referral_attributions (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  code TEXT NOT NULL REFERENCES referrals(code) ON DELETE CASCADE
);
CREATE INDEX referral_attributions_code ON referral_attributions(code);
