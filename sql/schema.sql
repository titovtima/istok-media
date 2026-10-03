-- Пульт медиаслужения: АКТУАЛЬНАЯ схема БД.
-- Для новых установок. Существующие БД обновляются через sql/migrations/.
--
-- Правило: schema.sql всегда отражает текущее состояние схемы.
-- При изменении схемы:
--   1) обновляем schema.sql (чтобы новые установки сразу получали актуальное);
--   2) добавляем sql/migrations/NNNN-<описание>.sql с ALTER/CREATE для уже
--      существующих БД.
-- db-init.mjs применяет schema.sql, только если БД пуста; иначе — миграции.

CREATE TABLE IF NOT EXISTS templates (
  id           TEXT PRIMARY KEY,
  module       TEXT NOT NULL CHECK (module IN ('tech')),
  grp          TEXT NOT NULL,
  label        TEXT NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_module_pos ON templates(module, position);

CREATE TABLE IF NOT EXISTS services (
  id           TEXT PRIMARY KEY,
  date         DATE NOT NULL,
  slot         INTEGER NOT NULL DEFAULT 1 CHECK (slot >= 1),
  outfit       TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, slot)
);
CREATE INDEX IF NOT EXISTS idx_services_date_slot ON services(date DESC, slot);

CREATE TABLE IF NOT EXISTS checks (
  service_id   TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  template_id  TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  done         BOOLEAN NOT NULL DEFAULT false,
  by_actor     TEXT,
  at_label     TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, template_id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id             TEXT PRIMARY KEY,
  author_login   TEXT NOT NULL,
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


CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  date           DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  resource       TEXT NOT NULL CHECK (resource IN ('small','big','studio')),
  title          TEXT NOT NULL,
  organizer_type TEXT NOT NULL CHECK (organizer_type IN ('person','ministry','church')),
  organizer_name TEXT NOT NULL,
  organizer_id   TEXT,
  note           TEXT NOT NULL DEFAULT '',
  created_by     TEXT,
  cancelled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);
CREATE INDEX IF NOT EXISTS idx_bookings_date     ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_resource ON bookings(resource);

CREATE TABLE IF NOT EXISTS booking_series (
  id             TEXT PRIMARY KEY,
  weekday        INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  resource       TEXT NOT NULL CHECK (resource IN ('small','big','studio')),
  title          TEXT NOT NULL,
  organizer_type TEXT NOT NULL CHECK (organizer_type IN ('person','ministry','church')),
  organizer_name TEXT NOT NULL,
  organizer_id   TEXT,
  note           TEXT NOT NULL DEFAULT '',
  repeat         TEXT NOT NULL CHECK (repeat IN ('weekly','biweekly')),
  anchor_date    DATE NOT NULL,
  created_by     TEXT,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);
CREATE INDEX IF NOT EXISTS idx_series_weekday ON booking_series(weekday);

CREATE TABLE IF NOT EXISTS booking_exceptions (
  series_id  TEXT NOT NULL REFERENCES booking_series(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  PRIMARY KEY (series_id, date)
);

CREATE TABLE IF NOT EXISTS attendance (
  event_key  TEXT NOT NULL,
  actor      TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('yes','no','maybe')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key, actor)
);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_key);


CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  login          TEXT NOT NULL UNIQUE,
  full_name      TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_admin       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------- Сиды (идемпотентно) ----------


INSERT INTO templates (id, module, grp, label, position) VALUES
  ('t1','tech','Звук','Resolume Arena запущен и стабильно работает',1),
  ('t2','tech','Звук','Dante-адаптер подключён и определяется в Resolume',2),
  ('t3','tech','Звук','Звук с Resolume идёт на пульт корректно (проверено на слух)',3),
  ('t4','tech','Экраны и ProPresenter','LED-экраны включены — только после проверки звука выше',4),
  ('t5','tech','Экраны и ProPresenter','Слова песен в ProPresenter выводятся без смещения и наложения',5),
  ('t6','tech','Экраны и ProPresenter','Текст Библии выводится без смещения, переход между стихами плавный',6),
  ('t7','tech','Экраны и ProPresenter','Футажи и анимации по соотношению сторон и разрешению соответствуют экрану',7),
  ('t8','tech','Свет','Художественный свет на сцене согласован по цвету и концепции с картинкой на экране',8),
  ('t9','tech','Свет','Свет и цвет экрана согласованы с цветом одежды прославления (сегодня: {outfit})',9),
  ('t10','tech','Трансляция','NDI-кабели всех камер (4–5 шт.) плотно подключены — картинка в Wirecast не бита и не стробит',10),
  ('t11','tech','Трансляция','Открывающая заставка стоит на месте по регламенту (регламент знает Алексей)',11),
  ('t12','tech','Трансляция','Закрывающие титры готовы к концу собрания',12),
  ('t13','tech','Трансляция','QR-код пожертвования на трансляции — только в правом нижнем углу, не перекрывает картинку',13),
  ('t14','tech','Трансляция','QR-код пожертвования на экранах в зале — на весь экран',14),
  ('t15','tech','Трансляция','Текст (слова/Библия) на трансляции мельче, чем на экранах в зале',15)
ON CONFLICT (id) DO NOTHING;
