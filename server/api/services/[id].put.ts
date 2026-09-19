import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { parseServiceId, toISODate } from '~~/server/utils/services'

interface Body { date: string; outfit?: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const parsed = parseServiceId(id)
  if (!parsed) throw createError({ statusCode: 400, statusMessage: 'invalid id format' })

  const body = await readBody<Body>(event)
  if (!body?.date) throw createError({ statusCode: 400, statusMessage: 'date required' })

  // date в URL имеет приоритет, но сверяем с тем, что прислал клиент
  const rows = await query<{ id: string; date: Date | string; slot: number; outfit: string }>(
    `INSERT INTO services (id, date, slot, outfit)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET outfit = EXCLUDED.outfit, updated_at = now()
     RETURNING id, date, slot, outfit`,
    [id, parsed.date, parsed.slot, body.outfit ?? '']
  )

  const row = rows[0]
  if (row) {
    broadcastToService(id, {
      type: 'service-meta-update',
      serviceId: id,
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
