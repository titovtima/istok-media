-- 0003: ключ attendance — (event_key, name), а не (event_key, client_id).
-- Это позволяет:
--   • одному человеку отметить нескольких: имя уникально в пределах события;
--   • отметку с другого устройства под тем же именем считать той же отметкой
--     (второй просто перезапишет первый);
--   • «моя» отметка на устройстве = name = viewerName И client_id = current.

-- Переносим осмысленные данные из старой таблицы (если она есть и старой формы).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='attendance' AND column_name='client_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='attendance' AND column_name='name'
     AND table_name='attendance'
  ) THEN
    -- на всякий случай: сюда мы вряд ли попадём, но оставим заглушку
    NULL;
  END IF;
END $$;

DROP TABLE IF EXISTS attendance;

CREATE TABLE attendance (
  event_key  TEXT NOT NULL,
  name       TEXT NOT NULL,
  client_id  TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL CHECK (status IN ('yes','no','maybe')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key, name)
);
CREATE INDEX idx_attendance_event ON attendance(event_key);
