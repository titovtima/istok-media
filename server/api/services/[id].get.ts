import { query } from '~~/server/utils/db'
import { parseServiceId, toISODate } from '~~/server/utils/services'
import type { CheckEntry, ServiceRecord } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ServiceRecord | null> => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const parsed = parseServiceId(id)
  if (!parsed) throw createError({ statusCode: 400, statusMessage: 'invalid id format' })

  const svc = await query<{ id: string; date: Date | string; slot: number; outfit: string }>(
    `SELECT id, date, slot, outfit FROM services WHERE id = $1`,
    [id]
  )
  if (!svc.length) return null

  const rows = await query<{
    template_id: string; done: boolean; by_name: string | null; at_label: string | null
  }>(
    `SELECT template_id, done, by_name, at_label FROM checks WHERE service_id = $1`,
    [id]
  )

  const checks: Record<string, CheckEntry> = {}
  for (const r of rows) {
    checks[r.template_id] = { done: r.done, by: r.by_name, at: r.at_label }
  }

  const s = svc[0]
  return {
    id: s.id,
    date: toISODate(s.date),
    slot: s.slot,
    outfit: s.outfit,
    checks,
  }
})
