import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { getUserFromEvent } from '~~/server/utils/auth'
import { getUserFromEvent } from '~~/server/utils/auth'
import type { BookingResource, OrganizerType, SeriesRepeat } from '~~/shared/types'

interface Body {
  mode: 'single' | 'weekly' | 'biweekly'
  date: string                // YYYY-MM-DD (для серии — дата первой брони)
  start: string               // HH:MM
  end: string                 // HH:MM
  resource: BookingResource
  title: string
  organizerType: OrganizerType
  organizerName: string
  organizerId?: string | null
  note?: string
  createdBy?: string | null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const date = (body?.date || '').trim()
  const start = (body?.start || '').trim()
  const end = (body?.end || '').trim()
  const title = (body?.title || '').trim()
  const organizerName = (body?.organizerName || '').trim()
  const mode = body?.mode

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw createError({ statusCode: 400, statusMessage: 'date required' })
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) throw createError({ statusCode: 400, statusMessage: 'time required' })
  if (start >= end) throw createError({ statusCode: 400, statusMessage: 'end must be after start' })
  if (!['small','big','studio'].includes(body?.resource)) throw createError({ statusCode: 400, statusMessage: 'resource required' })
  if (!['person','ministry','church'].includes(body?.organizerType)) throw createError({ statusCode: 400, statusMessage: 'organizerType required' })
  if (!title) throw createError({ statusCode: 400, statusMessage: 'title required' })
  if (!organizerName) throw createError({ statusCode: 400, statusMessage: 'organizerName required' })

  // -------- Права --------
  const me = await getUserFromEvent(event)
  if (!me) {
    throw createError({ statusCode: 401, statusMessage: 'создавать брони могут только зарегистрированные пользователи' })
  }
  if (body.organizerType === 'church' && !me.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'брони от имени церкви может создавать только администратор' })
  }

  const wsPayload = { type: 'booking-changed', date }

  if (mode === 'single' || !mode) {
    const id = 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const rows = await query(
      `INSERT INTO bookings
         (id, date, start_time, end_time, resource, title,
          organizer_type, organizer_name, organizer_id, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        id, date, start, end, body.resource, title,
        body.organizerType, organizerName, body.organizerId ?? null,
        body.note ?? '', body.createdBy ?? null,
      ]
    )
    broadcastToService('calendar', wsPayload)
    return { id: rows[0].id, seriesId: null }
  }

  // series
  const repeat: SeriesRepeat = mode === 'weekly' ? 'weekly' : 'biweekly'
  const weekday = (() => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d).getDay()
  })()

  const seriesId = 'sr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  await query(
    `INSERT INTO booking_series
       (id, weekday, start_time, end_time, resource, title,
        organizer_type, organizer_name, organizer_id, note, repeat, anchor_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      seriesId, weekday, start, end, body.resource, title,
      body.organizerType, organizerName, body.organizerId ?? null,
      body.note ?? '', repeat, date, body.createdBy ?? null,
    ]
  )
  broadcastToService('calendar', wsPayload)
  return { id: null, seriesId }
})
