-- 0009: метаданные сессий для отображения в /settings.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent   TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip           TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON sessions(user_id, last_seen_at DESC);
