import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'

interface Body { date: string }

// Отменяет отмену конкретной даты. Записи в attendance НЕ трогаем —
// ключ события 'series:<seriesId>:<date>' остаётся, все отметки сохраняются.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<Body>(event)
  if (!body?.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({ statusCode: 400, statusMessage: 'date required' })
  }

  await query(
    `DELETE FROM booking_exceptions WHERE series_id = $1 AND date = $2`,
    [id, body.date]
  )
  broadcastToService('calendar', { type: 'booking-changed', date: body.date })
  return { ok: true }
})
