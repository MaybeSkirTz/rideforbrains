ALTER TABLE user ADD COLUMN firstName TEXT;
ALTER TABLE user ADD COLUMN lastName TEXT;
CREATE TABLE auth_challenges (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('create','sign-in','password')),
 code_hash TEXT NOT NULL,
 credential_version TEXT NOT NULL,
 return_to TEXT NOT NULL,
 remember INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL,
 used_at INTEGER,
 sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX auth_challenges_user ON auth_challenges(user_id,created_at);
CREATE TABLE session_privacy (
 session_id TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
 tab_hash TEXT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
