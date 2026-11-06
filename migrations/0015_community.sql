CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  invite_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','hidden')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX teams_visibility ON teams(visibility,status,created_at);
CREATE TABLE team_members (
  registration_id TEXT PRIMARY KEY REFERENCES registrations(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  show_first INTEGER NOT NULL DEFAULT 0 CHECK(show_first IN (0,1)),
  joined_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX team_members_team ON team_members(team_id);
CREATE TABLE community_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('story','dedication')),
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  photo TEXT NOT NULL DEFAULT '',
  consent INTEGER NOT NULL DEFAULT 0 CHECK(consent IN (0,1)),
  status TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id,kind)
);
CREATE INDEX community_posts_status ON community_posts(kind,status,updated_at);
