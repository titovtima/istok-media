-- 0001: добавляем таблицу feedback.
-- Идемпотентно: если таблица уже есть (например, схема применена с нуля
-- новой версией schema.sql) — ничего не делаем.

CREATE TABLE IF NOT EXISTS feedback (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  service        TEXT NOT NULL CHECK (service IN ('vosslavlenie','poryadok','uborka','media','other')),
  other_note     TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL,
  resolved       BOOLEAN NOT NULL DEFAULT false,
  resolved_by    TEXT,
  resolved_at    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
