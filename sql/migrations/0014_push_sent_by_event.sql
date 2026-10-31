-- 0014: универсальный event_key вместо series_id.
-- Теперь push_notifications_sent привязан к event_key (booking:<id> или
-- series:<id>:<date>), а не только к сериям.

-- 1. Добавим event_key (null-safe).
ALTER TABLE push_notifications_sent ADD COLUMN IF NOT EXISTS event_key TEXT;

-- 2. Заполним для старых записей.
UPDATE push_notifications_sent
   SET event_key = 'series:' || series_id || ':' || date::text
 WHERE event_key IS NULL;

-- 3. Снимем старый PK и поставим новый по (event_key, user_id).
ALTER TABLE push_notifications_sent DROP CONSTRAINT IF EXISTS push_notifications_sent_pkey;
ALTER TABLE push_notifications_sent ALTER COLUMN event_key SET NOT NULL;
ALTER TABLE push_notifications_sent ADD PRIMARY KEY (event_key, user_id);

-- 4. Старую колонку series_id удаляем.
ALTER TABLE push_notifications_sent DROP COLUMN IF EXISTS series_id;

-- 5. На всякий случай убедимся, что date остался (для отладки) — он NOT NULL,
--    при вставке будем явно передавать.
