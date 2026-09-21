import { query } from '~~/server/utils/db'
import { toISODate } from '~~/server/utils/services'

interface Row { id: string; date: Date | string; slot: number }

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const dateFilter = typeof q.date === 'string' ? q.date : null

  if (dateFilter) {
    const rows = await query<Row>(
      `SELECT id, date, slot FROM services WHERE date = $1 ORDER BY slot ASC`,
      [dateFilter]
    )
    return rows.map(r => ({ id: r.id, date: toISODate(r.date), slot: r.slot }))
  }

  const rows = await query<Row>(
    `SELECT id, date, slot FROM services ORDER BY date DESC, slot ASC LIMIT 16`
  )
  return rows.map(r => ({ id: r.id, date: toISODate(r.date), slot: r.slot }))
})
