CREATE TABLE marketing_tokens (token TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE);
CREATE INDEX marketing_tokens_email ON marketing_tokens(email);
