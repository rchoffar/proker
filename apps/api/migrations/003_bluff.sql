CREATE TABLE bluff_games (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{6}$'),
  config TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 2 AND 6),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished', 'abandoned')),
  version INTEGER NOT NULL CHECK (version > 0),
  state TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE bluff_members (
  game_id TEXT NOT NULL REFERENCES bluff_games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT,
  seat INTEGER NOT NULL CHECK (seat BETWEEN 0 AND 5),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'forfeited')),
  PRIMARY KEY (game_id, player_id), UNIQUE (game_id, user_id), UNIQUE (game_id, seat)
);
CREATE INDEX idx_bluff_members_user ON bluff_members(user_id, game_id);
CREATE INDEX idx_bluff_public_rooms ON bluff_games(status, visibility, updated_at);
CREATE TABLE bluff_rounds (
  game_id TEXT NOT NULL REFERENCES bluff_games(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'cancelled')),
  result TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (game_id, round)
);
CREATE TABLE bluff_requests (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  game_id TEXT,
  PRIMARY KEY (user_id, request_id)
);
REVOKE ALL ON bluff_games, bluff_members, bluff_rounds, bluff_requests FROM PUBLIC;
