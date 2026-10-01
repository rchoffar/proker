CREATE TABLE users (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_user_id TEXT NOT NULL,
  email TEXT,
  pseudo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_user_id)
);
CREATE TABLE hands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  stakes TEXT,
  game_type TEXT NOT NULL DEFAULT 'NLH',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_hands_user_created ON hands (user_id, created_at DESC, id DESC);
CREATE TABLE rooms (
  code TEXT PRIMARY KEY CHECK (code ~ '^[0-9]{4}$'),
  state JSONB NOT NULL
);
CREATE TABLE socket_io_attachments (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload BYTEA NOT NULL
);
CREATE INDEX idx_socket_io_attachments_created ON socket_io_attachments (created_at);
REVOKE ALL ON users, hands, rooms, socket_io_attachments FROM PUBLIC;
REVOKE ALL ON SEQUENCE socket_io_attachments_id_seq FROM PUBLIC;
