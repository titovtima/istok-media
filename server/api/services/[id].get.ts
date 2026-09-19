import { query } from '~~/server/utils/db'
import type { CheckEntry, DayKey, ServiceRecord } from '~~/shared/types'

const DOW_TO_KEY: DayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday',
]

export default defineEventHandler(async (event): Promise<ServiceRecord | null> => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const svc = await query<{ id: string; date: Date | string; outfit: string }>(
    `SELECT id, date, outfit FROM services WHERE id = $1`,
    [id]
  )
  if (!svc.length) return null

  const rows = await query<{ template_id: string; done: boolean; by_name: string | null; at_label: string | null }>(
    `SELECT template_id, done, by_name, at_label FROM checks WHERE service_id = $1`,
    [id]
  )

  const checks: Record<string, CheckEntry> = {}
  for (const r of rows) {
    checks[r.template_id] = { done: r.done, by: r.by_name, at: r.at_label }
  }

  const s = svc[0]
  const iso = toISODate(s.date)
  const [y, m, d] = iso.split('-').map(Number)
  const day = DOW_TO_KEY[new Date(y, m - 1, d).getDay()]

  return { id: s.id, date: iso, day, outfit: s.outfit, checks }
})

function toISODate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
