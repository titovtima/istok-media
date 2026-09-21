import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { parseServiceId, resolveServiceId, toISODate } from '~~/server/utils/services'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const parsed = parseServiceId(rawId)
  if (!parsed) throw createError({ statusCode: 400, statusMessage: 'invalid id format' })

  // Найдём реальный id (может быть старый с '#').
  const existing = await resolveServiceId(rawId)
  const targetId = existing ? existing.id : rawId

  const rows = await query<{ id: string; date: string | Date; slot: number }>(
    `DELETE FROM services WHERE id = $1 RETURNING id, date, slot`,
    [targetId]
  )

  if (!rows.length) {
    // Нечего удалять — считаем операцию успешной, чтобы UI не падал.
    broadcastToService(`date:${parsed.date}`, {
      type: 'date-services-changed',
      date: parsed.date,
    })
    return { ok: true, alreadyDeleted: true }
  }

  const row = rows[0]
  const iso = toISODate(row.date)

  broadcastToService(row.id, {
    type: 'service-deleted',
    serviceId: row.id,
    date: iso,
    slot: row.slot,
  })
  broadcastToService(`date:${iso}`, {
    type: 'date-services-changed',
    date: iso,
  })
  return { ok: true }
})
