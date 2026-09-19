// ---------------------------------------------------------------------------
// Утилиты для ключей событий и раскрытия серий.
// ---------------------------------------------------------------------------

export function bookingEventKey(id: string): string {
  return `booking:${id}`
}

export function seriesEventKey(seriesId: string, date: string): string {
  return `series:${seriesId}:${date}`
}

export function parseEventKey(key: string): { kind: 'booking'; id: string }
  | { kind: 'series'; seriesId: string; date: string }
  | null {
  if (key.startsWith('booking:')) {
    return { kind: 'booking', id: key.slice(8) }
  }
  const m = /^series:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(key)
  if (m) return { kind: 'series', seriesId: m[1], date: m[2] }
  return null
}

// Разворачивает серии в конкретные виртуальные брони для диапазона дат.
// Исключает те, что уже отменены на конкретную дату или перебиты разовым booking
// с теми же (date, resource, start).
export interface SeriesRow {
  id: string
  weekday: number
  start_time: string
  end_time: string
  resource: 'small' | 'big' | 'studio'
  title: string
  organizer_type: 'person' | 'ministry' | 'church'
  organizer_name: string
  organizer_id: string | null
  note: string
  repeat: 'weekly' | 'biweekly'
  anchor_date: string          // YYYY-MM-DD
  deleted_at: Date | null
  created_by: string | null
}

export function isoDate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Генерирует все даты серии, попадающие в [from, to].
// from/to — ISO YYYY-MM-DD. weekday — 0..6. repeat — weekly | biweekly.
// Для biweekly: дата входит, только если разница в неделях от anchor_date чётная.
export function expandSeriesDates(
  series: SeriesRow,
  from: string,
  to: string,
  cancelledDates: Set<string>,
): { date: string; cancelled: boolean }[] {
  const out: { date: string; cancelled: boolean }[] = []
  if (series.deleted_at) return out

  const fromD = parseISO(from)
  const toD = parseISO(to)
  const anchor = parseISO(series.anchor_date)

  // ближайшая дата серии >= from
  const cur = new Date(fromD)
  const diff = (series.weekday - cur.getDay() + 7) % 7
  cur.setDate(cur.getDate() + diff)

  while (cur <= toD) {
    if (cur >= anchor) {
      const weeks = Math.round((cur.getTime() - anchor.getTime()) / (7 * 24 * 3600 * 1000))
      const ok = series.repeat === 'weekly' || (weeks % 2 === 0)
      if (ok) {
        const iso = isoDate(cur)
        out.push({ date: iso, cancelled: cancelledDates.has(iso) })
      }
    }
    cur.setDate(cur.getDate() + 7)
  }
  return out
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDaysISO(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
