import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  await query(
    `UPDATE booking_series
        SET deleted_at = now(), updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  // Broadкаст без конкретной даты — фронт перезагрузит весь видимый диапазон.
  broadcastToService('calendar', { type: 'booking-changed', date: '' })
  return { ok: true }
})
