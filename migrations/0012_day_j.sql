CREATE TABLE day_j_progress (
  registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK(step IN ('calendar','route','instructions','equipment')),
  PRIMARY KEY(registration_id,user_id,step)
);
