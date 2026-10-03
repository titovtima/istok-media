import { query } from '~~/server/utils/db'
import {
  isoDate, expandSeriesDates, bookingEventKey, seriesEventKey,
  type SeriesRow,
} from '~~/server/utils/events'
import { resolveActors, isAnonActor } from '~~/server/utils/actor'
import type {
  AttendanceRecord, AttendanceStatus, AttendanceSummary,
  BookingRecord, BookingResource, BookingWithAttendance,
  OrganizerType,
} from '~~/shared/types'

interface BookingRow {
  id: string
  date: string | Date
  start_time: string
  end_time: string
  resource: BookingResource
  title: string
  organizer_type: OrganizerType
  organizer_name: string
  organizer_id: string | null
  note: string
  created_by: string | null
  cancelled_at: Date | null
}

interface AttRow {
  event_key: string
  actor: string
  status: AttendanceStatus
}

function inClause(values: string[], startIndex = 1): { placeholders: string; values: string[] } | null {
  if (!values.length) return null
  const placeholders = values.map((_, i) => `$${startIndex + i}`).join(', ')
  return { placeholders, values }
}

export default defineEventHandler(async (event): Promise<BookingWithAttendance[]> => {
  const q = getQuery(event)
  const from = typeof q.from === 'string' ? q.from : isoDate(new Date())
  const to = typeof q.to === 'string' ? q.to : isoDate(addDays(new Date(), 6))

  const bookingRows = await query<BookingRow>(
    `SELECT id, date, start_time, end_time, resource, title,
            organizer_type, organizer_name, organizer_id, note, created_by, cancelled_at
       FROM bookings
      WHERE date >= $1 AND date <= $2
      ORDER BY date, start_time`,
    [from, to]
  )

  const seriesRows = await query<SeriesRow>(
    `SELECT id, weekday, start_time, end_time, resource, title,
            organizer_type, organizer_name, organizer_id, note,
            repeat, anchor_date::text AS anchor_date, deleted_at, created_by
       FROM booking_series
      WHERE deleted_at IS NULL
        AND anchor_date <= $1
      ORDER BY start_time`,
    [to]
  )

  const seriesIds = seriesRows.map(s => s.id)
  let exceptionsRows: { series_id: string; date: string | Date }[] = []
  const excClause = inClause(seriesIds)
  if (excClause) {
    exceptionsRows = await query<{ series_id: string; date: string | Date }>(
      `SELECT series_id, date FROM booking_exceptions
        WHERE series_id IN (${excClause.placeholders})`,
      excClause.values
    )
  }
  const cancelledBySeries = new Map<string, Set<string>>()
  for (const r of exceptionsRows) {
    const iso = isoDate(r.date)
    if (!cancelledBySeries.has(r.series_id)) cancelledBySeries.set(r.series_id, new Set())
    cancelledBySeries.get(r.series_id)!.add(iso)
  }

  const realSlot = new Set(
    bookingRows
      .filter(b => !b.cancelled_at)
      .map(b => `${isoDate(b.date)}|${b.resource}|${normalizeTime(b.start_time)}`)
  )

  const expanded: BookingRecord[] = []
  for (const s of seriesRows) {
    const cancelled = cancelledBySeries.get(s.id) ?? new Set<string>()
    const dates = expandSeriesDates(s, from, to, cancelled)
    for (const { date, cancelled: isCancelled } of dates) {
      const startNorm = normalizeTime(s.start_time)
      if (realSlot.has(`${date}|${s.resource}|${startNorm}`)) continue
      expanded.push({
        id: seriesEventKey(s.id, date),
        seriesId: s.id,
        date,
        start: startNorm,
        end: normalizeTime(s.end_time),
        resource: s.resource,
        title: s.title,
        organizerType: s.organizer_type,
        organizerName: s.organizer_name,
        organizerId: s.organizer_id,
        note: s.note,
        cancelled: isCancelled,
        createdBy: s.created_by,
      })
    }
  }

  const records: BookingRecord[] = [
    ...bookingRows.map<BookingRecord>(b => ({
      id: bookingEventKey(b.id),
      seriesId: null,
      date: isoDate(b.date),
      start: normalizeTime(b.start_time),
      end: normalizeTime(b.end_time),
      resource: b.resource,
      title: b.title,
      organizerType: b.organizer_type,
      organizerName: b.organizer_name,
      organizerId: b.organizer_id,
      note: b.note,
      cancelled: !!b.cancelled_at,
      createdBy: b.created_by,
    })),
    ...expanded,
  ]

  const eventKeys = records.map(r => r.id)
  let attRows: AttRow[] = []
  const attClause = inClause(eventKeys)
  if (attClause) {
    attRows = await query<AttRow>(
      `SELECT event_key, actor, status
         FROM attendance
        WHERE event_key IN (${attClause.placeholders})`,
      attClause.values
    )
  }

  // Резолвим display name для всех actor разом.
  const actors = Array.from(new Set(attRows.map(r => r.actor)))
  const actorNames = await resolveActors(actors)

  const attByEvent = new Map<string, AttendanceRecord[]>()
  for (const r of attRows) {
    if (!attByEvent.has(r.event_key)) attByEvent.set(r.event_key, [])
    attByEvent.get(r.event_key)!.push({
      actor: r.actor,
      displayName: actorNames.get(r.actor) ?? (isAnonActor(r.actor) ? r.actor.slice(5) : r.actor),
      status: r.status,
    })
  }

  const viewerActor = typeof q.viewerActor === 'string' ? q.viewerActor.trim() : ''

  const summary = (key: string): AttendanceSummary => {
    const list = attByEvent.get(key) ?? []
    let mine: AttendanceStatus | null = null
    if (viewerActor) {
      const rec = list.find(x => x.actor === viewerActor)
      if (rec) mine = rec.status
    }
    return {
      yes:   list.filter(x => x.status === 'yes'),
      no:    list.filter(x => x.status === 'no'),
      maybe: list.filter(x => x.status === 'maybe'),
      mine,
    }
  }

  return records
    .map(r => ({ ...r, attendance: summary(r.id) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start.localeCompare(b.start)))
})

function normalizeTime(t: string): string { return t.slice(0, 5) }
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}
