-- 0010: группы служений и их участники.

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- Стартовый набор служений. Идемпотентно.
INSERT INTO groups (id, label, position) VALUES
  ('worship',  'прославление',         1),
  ('media',    'медиаслужение',        2),
  ('order',    'служба порядка',       3),
  ('cleaning', 'уборка',               4),
  ('kids',     'детское служение',     5),
  ('youth',    'молодёжное служение',  6),
  ('prayer',   'молитвенное служение', 7)
ON CONFLICT (id) DO NOTHING;
