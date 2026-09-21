import pg from 'pg'
const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1) }
const c = new pg.Client({ connectionString: url })
await c.connect()
try {
  console.log('→ services (id, date, slot):')
  const r = await c.query(`SELECT id, date::text AS date, slot FROM services ORDER BY date DESC, slot ASC LIMIT 20`)
  if (!r.rows.length) console.log('  (пусто)')
  else r.rows.forEach(x => console.log(`  • ${x.id}  date=${x.date}  slot=${x.slot}`))

  console.log('\n→ checks (service_id, count):')
  const r2 = await c.query(`SELECT service_id, COUNT(*) AS n FROM checks GROUP BY service_id ORDER BY service_id`)
  if (!r2.rows.length) console.log('  (пусто)')
  else r2.rows.forEach(x => console.log(`  • ${x.service_id}: ${x.n}`))
} finally {
  await c.end()
}
