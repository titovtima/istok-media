// Приводит attendance/checks/feedback к целевой схеме, независимо от
// schema_migrations. Идемпотентно.
import pg from 'pg'
const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1) }

const c = new pg.Client({ connectionString: url })
await c.connect()
try {
  await c.query('BEGIN')

  // ---------- attendance ----------
  // Смотрим текущие колонки и PK.
  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='attendance'
  `)
  const colNames = cols.rows.map(r => r.column_name)
  console.log('→ attendance columns:', colNames.join(', ') || '(нет таблицы)')

  const hasActor = colNames.includes('actor')
  const hasName  = colNames.includes('name')
  const hasDisplay = colNames.includes('display_name')
  const needRebuild = !hasActor || hasName || hasDisplay

  if (needRebuild) {
    console.log('  → пересобираю attendance')

    // читаем исходные данные, насколько можем
    let old = []
    if (colNames.length) {
      const nameExpr = hasName ? 'name' : (hasDisplay ? 'display_name' : `NULL`)
      const clientExpr = colNames.includes('client_id') ? 'client_id' : `NULL`
      const statusExpr = colNames.includes('status') ? 'status' : `'yes'`
      const updatedExpr = colNames.includes('updated_at') ? 'updated_at' : `now()`
      try {
        const r = await c.query(`
          SELECT event_key, ${nameExpr} AS name, ${clientExpr} AS client_id,
                 ${statusExpr} AS status, ${updatedExpr} AS updated_at
            FROM attendance
        `)
        old = r.rows
        console.log(`  → переносим ${old.length} записей`)
      } catch (e) {
        console.warn('  ! не смог прочитать старые данные:', e.message)
      }
    }

    await c.query(`DROP TABLE IF EXISTS attendance`)
    await c.query(`
      CREATE TABLE attendance (
        event_key  TEXT NOT NULL,
        actor      TEXT NOT NULL,
        status     TEXT NOT NULL CHECK (status IN ('yes','no','maybe')),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (event_key, actor)
      )
    `)
    await c.query(`CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_key)`)

    // Перенос: если actor уже был, оставляем; иначе — из name/display_name/client_id.
    for (const r of old) {
      const name = (r.name ?? '').toString().trim()
      const client = (r.client_id ?? '').toString().trim()
      let actor
      if (name) actor = 'anon:' + name
      else if (client) actor = 'anon:' + client
      else actor = 'anon:unknown'
      const status = ['yes','no','maybe'].includes(r.status) ? r.status : 'yes'
      try {
        await c.query(`
          INSERT INTO attendance (event_key, actor, status, updated_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (event_key, actor) DO UPDATE
            SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
        `, [r.event_key, actor, status, r.updated_at || new Date()])
      } catch (e) {
        console.warn('  ! пропустил запись:', e.message)
      }
    }
    console.log('  ✓ attendance пересоздана')
  } else {
    console.log('  ✓ attendance уже в новой форме')
  }

  // ---------- checks ----------
  const checkCols = await c.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='checks'
  `)
  const hasByActor = checkCols.rows.some(r => r.column_name === 'by_actor')
  const hasByName  = checkCols.rows.some(r => r.column_name === 'by_name')

  if (!hasByActor) {
    console.log('  → добавляю checks.by_actor')
    await c.query(`ALTER TABLE checks ADD COLUMN by_actor TEXT`)
    if (hasByName) {
      await c.query(`
        UPDATE checks
           SET by_actor = CASE
             WHEN by_name IS NULL OR by_name = '' THEN 'anon:unknown'
             ELSE 'anon:' || by_name
           END
         WHERE by_actor IS NULL
      `)
    } else {
      await c.query(`UPDATE checks SET by_actor = 'anon:unknown' WHERE by_actor IS NULL`)
    }
  }
  console.log('  ✓ checks.by_actor на месте')

  // ---------- feedback ----------
  const fbCols = await c.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='feedback'
  `)
  const hasAuthor = fbCols.rows.some(r => r.column_name === 'author_login')
  const hasNameFb = fbCols.rows.some(r => r.column_name === 'name')

  if (!hasAuthor) {
    console.log('  → добавляю feedback.author_login')
    await c.query(`ALTER TABLE feedback ADD COLUMN author_login TEXT`)
    if (hasNameFb) {
      await c.query(`
        UPDATE feedback
           SET author_login = CASE
             WHEN name IS NULL OR name = '' THEN 'anon:unknown'
             ELSE 'anon:' || name
           END
         WHERE author_login IS NULL
      `)
    } else {
      await c.query(`UPDATE feedback SET author_login = 'anon:unknown' WHERE author_login IS NULL`)
    }
    // станет NOT NULL
    await c.query(`ALTER TABLE feedback ALTER COLUMN author_login SET NOT NULL`)
  }
  console.log('  ✓ feedback.author_login на месте')

  // помечаем миграцию применённой, чтобы db:init не пытался её переиграть
  await c.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await c.query(`
    INSERT INTO schema_migrations (name) VALUES ('0007_actor_only.sql')
    ON CONFLICT (name) DO NOTHING
  `)

  await c.query('COMMIT')
  console.log('✓ Схема приведена к целевой')
} catch (e) {
  await c.query('ROLLBACK')
  console.error('✗ Откат:', e.message)
  process.exit(1)
} finally {
  await c.end()
}
