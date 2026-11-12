-- Initial D1 identity foundation. IDs and token hashes are generated server-side.
-- This is a new database; it does not import historical Supabase records.
PRAGMA foreign_keys = ON;

CREATE TABLE app_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE profiles (
  id TEXT PRIMARY KEY NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  full_name TEXT,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE workshops (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
  country_code TEXT NOT NULL DEFAULT 'BR' CHECK(length(country_code) = 2),
  currency_code TEXT NOT NULL DEFAULT 'BRL' CHECK(length(currency_code) = 3),
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE workshop_users (
  workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'mechanic' CHECK(role IN ('admin','mechanic','attendant','inventory')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(workshop_id, user_id)
);
CREATE INDEX workshop_users_user_id ON workshop_users(user_id, workshop_id);

-- Only SHA-256 token hashes belong here, never the bearer token itself.
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK(length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expiration ON auth_sessions(expires_at);
CREATE TABLE auth_email_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK(length(token_hash) = 64),
  email TEXT NOT NULL COLLATE NOCASE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX auth_email_tokens_expiration ON auth_email_tokens(expires_at);
CREATE TABLE cr_schema_migrations (
  name TEXT PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO cr_schema_migrations(name) VALUES ('0001_identity');
