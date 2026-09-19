// ---------------------------------------------------------------------------
// db-init:
//   • Если в БД ещё нет ни одной из наших таблиц (templates/services/checks/
//     feedback) — применяем schema.sql целиком (это новая установка).
//   • Иначе — прогоняем недостающие миграции из sql/migrations/, помечая
//     применённые в таблице schema_migrations.
//
// Плюс: можно форсировать схему флагом --force-schema (перезапишет).
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1) }

const forceSchema = process.argv.includes('--force-schema')

const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const { rows: tableRows } = await client.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('templates','services','checks','feedback')
  `)
  const isFresh = forceSchema || tableRows.length === 0

  if (isFresh) {
    console.log('→ Свежая установка: применяю schema.sql')
    const sql = readFileSync(join(ROOT, 'sql', 'schema.sql'), 'utf8')
    await client.query(sql)
    // помечаем все существующие миграции как применённые,
    // чтобы потом не пытаться накатывать их поверх актуальной схемы
    const migrations = listMigrations()
    for (const m of migrations) {
      await client.query(
        `INSERT INTO schema_migrations (name) VALUES ($1)
         ON CONFLICT (name) DO NOTHING`,
        [m]
      )
    }
    console.log('✓ Схема применена, миграций помечено:', migrations.length)
  } else {
    console.log('→ Существующая БД: применяю недостающие миграции')
    const applied = new Set(
      (await client.query(`SELECT name FROM schema_migrations`))
        .rows.map(r => r.name)
    )
    const pending = listMigrations().filter(m => !applied.has(m))
    if (!pending.length) {
      console.log('✓ Все миграции уже применены')
    } else {
      for (const name of pending) {
        const sql = readFileSync(join(ROOT, 'sql', 'migrations', name), 'utf8')
        console.log('  →', name)
        await client.query('BEGIN')
        try {
          await client.query(sql)
          await client.query(
            `INSERT INTO schema_migrations (name) VALUES ($1)`,
            [name]
          )
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      }
      console.log('✓ Применено миграций:', pending.length)
    }
  }
} finally {
  await client.end()
}

function listMigrations() {
  const dir = join(ROOT, 'sql', 'migrations')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()
}
