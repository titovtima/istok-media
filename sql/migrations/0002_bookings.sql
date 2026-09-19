-- 0002: бронирование залов + регулярные брони + отметки присутствия.

-- Разовые и «материализованные» брони.
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
  created_by     TEXT,                  -- clientId автора
  cancelled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);
CREATE INDEX IF NOT EXISTS idx_bookings_date      ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_resource  ON bookings(resource);

-- Регулярные брони.
CREATE TABLE IF NOT EXISTS booking_series (
  id             TEXT PRIMARY KEY,
  weekday        INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=вс
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  resource       TEXT NOT NULL CHECK (resource IN ('small','big','studio')),
  title          TEXT NOT NULL,
  organizer_type TEXT NOT NULL CHECK (organizer_type IN ('person','ministry','church')),
  organizer_name TEXT NOT NULL,
  organizer_id   TEXT,
  note           TEXT NOT NULL DEFAULT '',
  repeat         TEXT NOT NULL CHECK (repeat IN ('weekly','biweekly')),
  anchor_date    DATE NOT NULL,         -- дата первой брони, отсчёт бинедели
  created_by     TEXT,
  deleted_at     TIMESTAMPTZ,           -- отмена серии целиком
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);
CREATE INDEX IF NOT EXISTS idx_series_weekday ON booking_series(weekday);

-- Отмены отдельных дат регулярных броней.
CREATE TABLE IF NOT EXISTS booking_exceptions (
  series_id  TEXT NOT NULL REFERENCES booking_series(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  PRIMARY KEY (series_id, date)
);

-- Отметки присутствия. event_key = 'booking:<id>' или 'series:<seriesId>:<date>'.
CREATE TABLE IF NOT EXISTS attendance (
  event_key  TEXT NOT NULL,
  client_id  TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL CHECK (status IN ('yes','no','maybe')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key, client_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_key);
