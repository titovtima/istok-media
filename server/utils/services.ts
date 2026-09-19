// ---------------------------------------------------------------------------
// Формат serviceId: "YYYY-MM-DD" (slot=1) или "YYYY-MM-DD#N" (slot=N).
// ---------------------------------------------------------------------------

export interface ParsedServiceId {
  date: string       // YYYY-MM-DD
  slot: number       // 1 по умолчанию
}

export function parseServiceId(id: string): ParsedServiceId | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:#(\d+))?$/.exec(id)
  if (!m) return null
  const slot = m[2] ? parseInt(m[2], 10) : 1
  if (!Number.isFinite(slot) || slot < 1) return null
  return { date: m[1], slot }
}

export function buildServiceId(date: string, slot: number): string {
  return slot <= 1 ? date : `${date}#${slot}`
}

export function toISODate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
