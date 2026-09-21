// ---------------------------------------------------------------------------
// Формат serviceId: "YYYY-MM-DD" (slot=1) или "YYYY-MM-DD<N>slot" (slot=N).
//
// Исторически было три варианта разделителя:
//   • '#' — не работает, потому что '#' в URL это fragment;
//   • '~' — текущий;
//   • 'N' — на случай переименований (не используется, но пусть будет).
//
// parseServiceId принимает и '~', и '#' — чтобы читать старые данные.
// resolveServiceId идёт в БД и возвращает тот id, который реально есть,
// чтобы не зависеть от того, прогналась ли миграция.
// ---------------------------------------------------------------------------

import { query } from './db'

export interface ParsedServiceId {
  date: string
  slot: number
}

export const SLOT_SEPARATOR = '~'

export function parseServiceId(id: string): ParsedServiceId | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[~#](\d+))?$/.exec(id)
  if (!m) return null
  const slot = m[2] ? parseInt(m[2], 10) : 1
  if (!Number.isFinite(slot) || slot < 1) return null
  return { date: m[1], slot }
}

export function buildServiceId(date: string, slot: number): string {
  return slot <= 1 ? date : `${date}${SLOT_SEPARATOR}${slot}`
}

export function toISODate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Возвращает реальный id сервиса в БД. Пробует:
//   1) как есть;
//   2) с '~' → '#' (старые данные);
//   3) с '#' → '~' (новые данные при старом URL).
// Возвращает { id, date, slot } или null.
export async function resolveServiceId(rawId: string): Promise<{ id: string; date: string; slot: number } | null> {
  const parsed = parseServiceId(rawId)
  if (!parsed) return null

  const candidates = new Set<string>()
  candidates.add(rawId)
  candidates.add(buildServiceId(parsed.date, parsed.slot))
  if (parsed.slot > 1) {
    candidates.add(`${parsed.date}#${parsed.slot}`)
    candidates.add(`${parsed.date}~${parsed.slot}`)
  } else {
    candidates.add(parsed.date)
  }

  const list = Array.from(candidates)
  const placeholders = list.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await query<{ id: string; date: string | Date; slot: number }>(
    `SELECT id, date, slot FROM services WHERE id IN (${placeholders}) LIMIT 1`,
    list
  )
  if (!rows.length) return null
  const r = rows[0]
  return { id: r.id, date: toISODate(r.date), slot: r.slot }
}
