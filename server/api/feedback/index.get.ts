import { query } from '~~/server/utils/db'
import type { FeedbackEntry, FeedbackService } from '~~/shared/types'

interface Row {
  id: string
  name: string
  service: FeedbackService
  other_note: string
  description: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: Date | string
}

export default defineEventHandler(async (): Promise<FeedbackEntry[]> => {
  const rows = await query<Row>(
    `SELECT id, name, service, other_note, description,
            resolved, resolved_by, resolved_at, created_at
       FROM feedback
      ORDER BY created_at DESC
      LIMIT 500`
  )
  return rows.map(rowToEntry)
})

export function rowToEntry(r: Row): FeedbackEntry {
  const iso = typeof r.created_at === 'string'
    ? r.created_at
    : r.created_at.toISOString()
  return {
    id: r.id,
    name: r.name,
    service: r.service,
    otherNote: r.other_note,
    description: r.description,
    resolved: r.resolved,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at,
    createdAt: iso,
    createdLabel: formatShort(iso),
  }
}

export function formatShort(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}
