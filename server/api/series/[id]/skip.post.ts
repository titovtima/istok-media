import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'

interface Body { date: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<Body>(event)
  if (!body?.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({ statusCode: 400, statusMessage: 'date required' })
  }

  await query(
    `INSERT INTO booking_exceptions (series_id, date)
     VALUES ($1, $2)
     ON CONFLICT (series_id, date) DO NOTHING`,
    [id, body.date]
  )
  broadcastToService('calendar', { type: 'booking-changed', date: body.date })
  return { ok: true }
})
