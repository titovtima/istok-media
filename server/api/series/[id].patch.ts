import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import type { BookingResource, OrganizerType, SeriesRepeat } from '~~/shared/types'

interface Body {
  weekday?: number
  start?: string
  end?: string
  resource?: BookingResource
  title?: string
  organizerType?: OrganizerType
  organizerName?: string
  organizerId?: string | null
  note?: string
  repeat?: SeriesRepeat
}

const RESOURCES: BookingResource[] = ['small', 'big', 'studio']
const ORGANIZERS: OrganizerType[] = ['person', 'ministry', 'church']
const REPEATS: SeriesRepeat[] = ['weekly', 'biweekly']

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<Body>(event)

  const sets: string[] = []
  const params: any[] = []
  let i = 1

  if (body.weekday !== undefined) {
    if (!Number.isInteger(body.weekday) || body.weekday < 0 || body.weekday > 6) {
      throw createError({ statusCode: 400, statusMessage: 'invalid weekday' })
    }
    sets.push(`weekday = $${i++}`); params.push(body.weekday)
  }
  if (body.start !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(body.start)) throw createError({ statusCode: 400, statusMessage: 'invalid start' })
    sets.push(`start_time = $${i++}`); params.push(body.start)
  }
  if (body.end !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(body.end)) throw createError({ statusCode: 400, statusMessage: 'invalid end' })
    sets.push(`end_time = $${i++}`); params.push(body.end)
  }
  if (body.resource !== undefined) {
    if (!RESOURCES.includes(body.resource)) throw createError({ statusCode: 400, statusMessage: 'invalid resource' })
    sets.push(`resource = $${i++}`); params.push(body.resource)
  }
  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) throw createError({ statusCode: 400, statusMessage: 'title required' })
    sets.push(`title = $${i++}`); params.push(t)
  }
  if (body.organizerType !== undefined) {
    if (!ORGANIZERS.includes(body.organizerType)) throw createError({ statusCode: 400, statusMessage: 'invalid organizerType' })
    sets.push(`organizer_type = $${i++}`); params.push(body.organizerType)
  }
  if (body.organizerName !== undefined) {
    const n = body.organizerName.trim()
    if (!n) throw createError({ statusCode: 400, statusMessage: 'organizerName required' })
    sets.push(`organizer_name = $${i++}`); params.push(n)
  }
  if (body.organizerId !== undefined) {
    sets.push(`organizer_id = $${i++}`); params.push(body.organizerId)
  }
  if (body.note !== undefined) {
    sets.push(`note = $${i++}`); params.push(body.note)
  }
  if (body.repeat !== undefined) {
    if (!REPEATS.includes(body.repeat)) throw createError({ statusCode: 400, statusMessage: 'invalid repeat' })
    sets.push(`repeat = $${i++}`); params.push(body.repeat)
  }

  if (!sets.length) throw createError({ statusCode: 400, statusMessage: 'nothing to update' })
  sets.push(`updated_at = now()`)

  const cur = await query<{ start_time: string; end_time: string }>(
    `SELECT start_time, end_time FROM booking_series WHERE id = $1`,
    [id]
  )
  if (!cur.length) throw createError({ statusCode: 404, statusMessage: 'not found' })

  const nextStart = body.start ?? cur[0].start_time.slice(0, 5)
  const nextEnd = body.end ?? cur[0].end_time.slice(0, 5)
  if (nextStart >= nextEnd) throw createError({ statusCode: 400, statusMessage: 'end must be after start' })

  params.push(id)
  await query(
    `UPDATE booking_series SET ${sets.join(', ')} WHERE id = $${i}`,
    params
  )

  // Перерисуем весь видимый диапазон — даты серии могли поменяться.
  broadcastToService('calendar', { type: 'booking-changed', date: '' })
  return { ok: true }
})
