import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { parseServiceId, resolveServiceId, toISODate } from '~~/server/utils/services'

interface Body { date: string; outfit?: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const parsed = parseServiceId(id)
  if (!parsed) throw createError({ statusCode: 400, statusMessage: 'invalid id format' })

  const body = await readBody<Body>(event)
  if (!body?.date) throw createError({ statusCode: 400, statusMessage: 'date required' })

  // Если запись уже существует под старым id ('#'), обновляем именно её.
  const existing = await resolveServiceId(id)
  const targetId = existing ? existing.id : id

  const rows = await query<{ id: string; date: Date | string; slot: number; outfit: string }>(
    `INSERT INTO services (id, date, slot, outfit)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET outfit = EXCLUDED.outfit, updated_at = now()
     RETURNING id, date, slot, outfit`,
    [targetId, parsed.date, parsed.slot, body.outfit ?? '']
  )

  const row = rows[0]
  if (row) {
    broadcastToService(row.id, {
      type: 'service-meta-update',
      serviceId: row.id,
      date: toISODate(row.date),
      outfit: row.outfit,
    })
  }
  return {
    id: row.id,
    date: toISODate(row.date),
    slot: row.slot,
    outfit: row.outfit,
  }
})
