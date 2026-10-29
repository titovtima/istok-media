-- 0011: убираем колонку feedback.name.
-- Имя автора хранится в author_login (для залогиненных — логин,
-- для анонимов — 'anon:<имя>'). Отображаемое имя вычисляется из users
-- или из хвоста author_login.
ALTER TABLE feedback DROP COLUMN IF EXISTS name;
