-- 0007: у отметок храним только actor.
--   • залогинен → user.login
--   • аноним     → 'anon:' || display_name
-- Отображаемое имя не храним — вычисляем из users.full_name или из actor.

-- ---------- attendance ----------
-- Текущая схема: (event_key, name) PRIMARY KEY, плюс client_id.
-- Новая: (event_key, actor) PRIMARY KEY, без name и client_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='attendance' AND column_name='name'
  ) THEN
    -- создаём новую таблицу
    CREATE TABLE attendance_new (
      event_key  TEXT NOT NULL,
      actor      TEXT NOT NULL,
      status     TEXT NOT NULL CHECK (status IN ('yes','no','maybe')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (event_key, actor)
    );

    INSERT INTO attendance_new (event_key, actor, status, updated_at)
    SELECT
      event_key,
      CASE
        WHEN name IS NULL OR name = '' THEN 'anon:unknown'
        ELSE 'anon:' || name
      END,
      status,
      updated_at
    FROM attendance
    ON CONFLICT (event_key, actor) DO NOTHING;

    DROP TABLE attendance;
    ALTER TABLE attendance_new RENAME TO attendance;
    CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_key);
  END IF;
END $$;

-- ---------- checks ----------
-- Добавляем by_actor; by_name удаляем позже отдельным шагом (после того
-- как клиенты перестанут его читать).
ALTER TABLE checks ADD COLUMN IF NOT EXISTS by_actor TEXT;
UPDATE checks
   SET by_actor = CASE
     WHEN by_name IS NULL OR by_name = '' THEN 'anon:unknown'
     ELSE 'anon:' || by_name
   END
 WHERE by_actor IS NULL;

-- ---------- feedback ----------
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_login TEXT;
UPDATE feedback
   SET author_login = CASE
     WHEN name IS NULL OR name = '' THEN 'anon:unknown'
     ELSE 'anon:' || name
   END
 WHERE author_login IS NULL;
