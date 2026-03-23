CREATE TABLE IF NOT EXISTS licenses (
  license_key TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  owner TEXT,
  type TEXT NOT NULL DEFAULT 'lifetime',
  expires_at INTEGER,
  bound_serial TEXT,
  activated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS machines (
  system_serial TEXT PRIMARY KEY,
  device_model TEXT,
  last_seen_at INTEGER,
  metadata_json TEXT
);
