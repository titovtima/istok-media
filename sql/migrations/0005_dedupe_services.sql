-- 0005: если из-за бага с '#' успели появиться дубли (одна и та же
-- (date, slot) под разными id), схлопываем их. UNIQUE (date, slot)
-- теоретически это не позволит, но если где-то данные появились в обход
-- (например, slot не проставлялся), удаляем дубли, оставляя первый
-- по created_at.

DELETE FROM services a
 USING services b
 WHERE a.ctid > b.ctid
   AND a.date = b.date
   AND a.slot = b.slot;
