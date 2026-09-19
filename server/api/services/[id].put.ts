import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import type { DayKey } from '~~/shared/types'

interface Body { date: string; day: DayKey; outfit?: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<Body>(event)
  if (!body?.date || !body?.day) {
    throw createError({ statusCode: 400, statusMessage: 'date and day required' })
  }

  const rows = await query<{ id: string; date: string | Date; day: DayKey; outfit: string }>(
    `INSERT INTO services (id, date, day, outfit)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET outfit = EXCLUDED.outfit, updated_at = now()
     RETURNING id, date, day, outfit`,
    [id, body.date, body.day, body.outfit ?? '']
  )

  const row = rows[0]
  if (row) {
    const iso = typeof row.date === 'string' ? row.date.slice(0, 10) : isoDate(row.date)
    broadcastToService(id, {
      type: 'service-meta-update',
      serviceId: id,
      date: iso,
      day: row.day,
      outfit: row.outfit,
    })
  }

  return rows[0]
})

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
