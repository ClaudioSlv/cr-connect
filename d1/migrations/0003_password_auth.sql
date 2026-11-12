-- Password credentials and offline recovery. Neither plaintext passwords nor
-- plaintext recovery codes are stored. Email ownership remains unverified.
CREATE TABLE auth_passwords (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL CHECK(length(salt)=64),
  password_hash TEXT NOT NULL CHECK(length(password_hash)=64),
  iterations INTEGER NOT NULL CHECK(iterations>=100000),
  recovery_hash TEXT NOT NULL CHECK(length(recovery_hash)=64),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO cr_schema_migrations(name) VALUES ('0003_password_auth');
