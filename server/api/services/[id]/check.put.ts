import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { parseServiceId } from '~~/server/utils/services'

interface Body {
  templateId: string
  done: boolean
  by?: string | null
  at?: string | null
}

export default defineEventHandler(async (event) => {
  const serviceId = getRouterParam(event, 'id')
  if (!serviceId) throw createError({ statusCode: 400, statusMessage: 'serviceId required' })

  const parsed = parseServiceId(serviceId)
  if (!parsed) throw createError({ statusCode: 400, statusMessage: 'invalid id format' })

  const body = await readBody<Body>(event)
  if (!body?.templateId) throw createError({ statusCode: 400, statusMessage: 'templateId required' })

  // гарантируем строку services (id → date+slot выводим из самого id)
  await query(
    `INSERT INTO services (id, date, slot) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [serviceId, parsed.date, parsed.slot]
  )

  const rows = await query<{ updated_at: Date }>(
    `INSERT INTO checks (service_id, template_id, done, by_name, at_label, updated_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (service_id, template_id) DO UPDATE
       SET done = EXCLUDED.done,
           by_name = EXCLUDED.by_name,
           at_label = EXCLUDED.at_label,
           updated_at = now()
     RETURNING updated_at`,
    [serviceId, body.templateId, !!body.done, body.by ?? null, body.at ?? null]
  )

  const updatedAt = rows[0]?.updated_at instanceof Date
    ? rows[0].updated_at.toISOString()
    : new Date().toISOString()

  broadcastToService(serviceId, {
    type: 'check-update',
    serviceId,
    templateId: body.templateId,
    done: !!body.done,
    by: body.by ?? null,
    at: body.at ?? null,
    updatedAt,
  })

  return { ok: true }
})
