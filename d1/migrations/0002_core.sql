-- Core workshop data. Compound keys prevent cross-workshop relationships.
ALTER TABLE workshops ADD COLUMN creator_user_id TEXT REFERENCES app_users(id);
CREATE UNIQUE INDEX workshops_creator ON workshops(creator_user_id) WHERE creator_user_id IS NOT NULL;
ALTER TABLE workshops ADD COLUMN phone TEXT;
ALTER TABLE workshops ADD COLUMN whatsapp TEXT;
CREATE TABLE clients (
  id TEXT PRIMARY KEY NOT NULL,
  workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK(length(trim(full_name)) BETWEEN 2 AND 200),
  document_number TEXT, phone TEXT, whatsapp TEXT, email TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(workshop_id,id), UNIQUE(workshop_id,document_number)
);
CREATE INDEX clients_workshop_name ON clients(workshop_id,full_name);
CREATE INDEX clients_email ON clients(email COLLATE NOCASE);
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY NOT NULL,
  workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  plate TEXT, brand TEXT NOT NULL CHECK(length(trim(brand)) BETWEEN 1 AND 120),
  model TEXT NOT NULL CHECK(length(trim(model)) BETWEEN 1 AND 120),
  version TEXT, year_model INTEGER CHECK(year_model BETWEEN 1886 AND 2200),
  fuel TEXT, engine TEXT, mileage INTEGER CHECK(mileage >= 0), vin TEXT, notes TEXT,
  timing_belt_changed_at TEXT, timing_belt_changed_mileage INTEGER CHECK(timing_belt_changed_mileage >= 0),
  timing_belt_reminder_at TEXT, timing_belt_reminder_mileage INTEGER CHECK(timing_belt_reminder_mileage >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(workshop_id,id), UNIQUE(workshop_id,plate),
  FOREIGN KEY(workshop_id,client_id) REFERENCES clients(workshop_id,id) ON DELETE RESTRICT
);
CREATE INDEX vehicles_workshop_created ON vehicles(workshop_id,created_at DESC);
CREATE INDEX vehicles_workshop_client ON vehicles(workshop_id,client_id);

-- Atomic email/IP rate limits. Keys contain hashes, not email/IP values.
CREATE TABLE auth_rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  resets_at INTEGER NOT NULL
);
CREATE INDEX auth_rate_limits_expiry ON auth_rate_limits(resets_at);
ALTER TABLE auth_email_tokens ADD COLUMN browser_hash TEXT;
INSERT INTO cr_schema_migrations(name) VALUES ('0002_core');
