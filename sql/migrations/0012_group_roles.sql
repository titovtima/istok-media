-- 0012: роли внутри групп и выбор ролей при отметке присутствия.

CREATE TABLE IF NOT EXISTS group_roles (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, label)
);
CREATE INDEX IF NOT EXISTS idx_group_roles_group ON group_roles(group_id);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS role_ids TEXT[] NOT NULL DEFAULT '{}';
