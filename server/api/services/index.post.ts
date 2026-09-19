import { query } from '~~/server/utils/db'
import { toISODate, buildServiceId } from '~~/server/utils/services'

interface Body { date: string }

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({ statusCode: 400, statusMessage: 'date (YYYY-MM-DD) required' })
  }
  const date = body.date

  // следующий свободный slot на эту дату
  const maxRow = await query<{ max: number | null }>(
    `SELECT MAX(slot) AS max FROM services WHERE date = $1`,
    [date]
  )
  const nextSlot = (maxRow[0]?.max ?? 0) + 1
  const id = buildServiceId(date, nextSlot)

  const rows = await query<{ id: string; date: Date | string; slot: number; outfit: string }>(
    `INSERT INTO services (id, date, slot, outfit)
     VALUES ($1, $2, $3, '')
     RETURNING id, date, slot, outfit`,
    [id, date, nextSlot]
  )
  const row = rows[0]
  return {
    id: row.id,
    date: toISODate(row.date),
    slot: row.slot,
    outfit: row.outfit,
  }
})
