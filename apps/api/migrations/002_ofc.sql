CREATE TABLE ofc_games (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{6}$'),
  variant TEXT NOT NULL CHECK (variant IN ('classic', 'pineapple')),
  starting_stack INTEGER NOT NULL CHECK (starting_stack BETWEEN 1 AND 1000000),
  capacity INTEGER NOT NULL CHECK (capacity IN (2, 3)),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished', 'abandoned')),
  version INTEGER NOT NULL CHECK (version > 0),
  state TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE ofc_members (
  game_id TEXT NOT NULL REFERENCES ofc_games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT,
  seat INTEGER NOT NULL CHECK (seat BETWEEN 0 AND 2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'forfeited')),
  PRIMARY KEY (game_id, player_id), UNIQUE (game_id, user_id), UNIQUE (game_id, seat)
);
CREATE INDEX idx_ofc_members_user ON ofc_members(user_id, game_id);
CREATE INDEX idx_ofc_public_rooms ON ofc_games(status, visibility, updated_at);
CREATE TABLE ofc_hands (
  game_id TEXT NOT NULL REFERENCES ofc_games(id) ON DELETE CASCADE,
  hand_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'cancelled')),
  result TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (game_id, hand_number)
);
CREATE TABLE ofc_requests (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  game_id TEXT,
  PRIMARY KEY (user_id, request_id)
);
REVOKE ALL ON ofc_games, ofc_members, ofc_hands, ofc_requests FROM PUBLIC;
