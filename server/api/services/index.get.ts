import { query } from '~~/server/utils/db'
import type { DayKey } from '~~/shared/types'

const DOW_TO_KEY: DayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday',
]

export default defineEventHandler(async () => {
  const rows = await query<{ id: string; date: Date | string }>(
    `SELECT id, date FROM services ORDER BY date DESC LIMIT 8`
  )
  return rows.map(r => {
    const iso = toISODate(r.date)
    const [y, m, d] = iso.split('-').map(Number)
    const day = DOW_TO_KEY[new Date(y, m - 1, d).getDay()]
    return { id: r.id, date: iso, day }
  })
})

function toISODate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
