-- Пульт медиаслужения: схема БД
-- В один день может быть несколько собраний (slot = 1, 2, 3, ...).
-- Колонки day нет: день недели вычисляется на клиенте из date.

DROP TABLE IF EXISTS checks;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS templates;

CREATE TABLE templates (
  id           TEXT PRIMARY KEY,
  module       TEXT NOT NULL CHECK (module IN ('tech')),
  grp          TEXT NOT NULL,
  label        TEXT NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_module_pos ON templates(module, position);

CREATE TABLE services (
  id           TEXT PRIMARY KEY,                 -- "YYYY-MM-DD" для slot=1, "YYYY-MM-DD#N" для slot=N
  date         DATE NOT NULL,
  slot         INTEGER NOT NULL DEFAULT 1 CHECK (slot >= 1),
  outfit       TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, slot)
);
CREATE INDEX idx_services_date_slot ON services(date DESC, slot);

CREATE TABLE checks (
  service_id   TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  template_id  TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  done         BOOLEAN NOT NULL DEFAULT false,
  by_name      TEXT,
  at_label     TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, template_id)
);

-- ---------- Сиды ----------
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
  ('t15','tech','Трансляция','Текст (слова/Библия) на трансляции мельче, чем на экранах в зале',15);
