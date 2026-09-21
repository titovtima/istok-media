-- 0004: меняем разделитель serviceId с '#' на '~'.
-- Причина: '#' в URL — это fragment, браузер его не отправляет на сервер.
-- Запрос /api/services/2025-09-17#2/check фактически означал
-- /api/services/2025-09-17, поэтому все слоты синхронизировались.

-- 1. services.id
UPDATE services
   SET id = REPLACE(id, '#', '~')
 WHERE id LIKE '%#%';

-- 2. checks.service_id — FK, значение меняется вместе с services.id
UPDATE checks
   SET service_id = REPLACE(service_id, '#', '~')
 WHERE service_id LIKE '%#%';
