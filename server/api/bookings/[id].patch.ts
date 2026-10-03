import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { getUserFromEvent } from '~~/server/utils/auth'
import type { BookingResource, OrganizerType } from '~~/shared/types'

interface Body {
  date?: string
  start?: string
  end?: string
  resource?: BookingResource
  title?: string
  organizerType?: OrganizerType
  organizerName?: string
  organizerId?: string | null
  note?: string
}

const RESOURCES: BookingResource[] = ['small', 'big', 'studio']
const ORGANIZERS: OrganizerType[] = ['person', 'ministry', 'church']

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<Body>(event)

  // -------- Права --------
  const me = await getUserFromEvent(event)
  if (!me) {
    throw createError({ statusCode: 401, statusMessage: 'редактировать брони могут только зарегистрированные пользователи' })
  }

  // Смотрим текущую организацию брони.
  const curOrg = await query<{ organizer_type: string }>(
    `SELECT organizer_type FROM bookings WHERE id = $1`,
    [id]
  )
  if (!curOrg.length) {
    // дальше идёт обработка отсутствия — оставим как есть
  }
  const wasChurch = curOrg[0]?.organizer_type === 'church'
  const becomesChurch = body.organizerType === 'church'
  if ((wasChurch || becomesChurch) && !me.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'брони от имени церкви может редактировать только администратор' })
  }

  const sets: string[] = []
  const params: any[] = []
  let i = 1

  if (body.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw createError({ statusCode: 400, statusMessage: 'invalid date' })
    sets.push(`date = $${i++}`); params.push(body.date)
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

  if (!sets.length) throw createError({ statusCode: 400, statusMessage: 'nothing to update' })
  sets.push(`updated_at = now()`)

  // Проверка, что start < end после применения изменений: читаем текущие значения.
  const cur = await query<{ start_time: string; end_time: string; date: string | Date }>(
    `SELECT start_time, end_time, date FROM bookings WHERE id = $1`,
    [id]
  )
  if (!cur.length) throw createError({ statusCode: 404, statusMessage: 'not found' })

  const nextStart = body.start ?? cur[0].start_time.slice(0, 5)
  const nextEnd = body.end ?? cur[0].end_time.slice(0, 5)
  if (nextStart >= nextEnd) throw createError({ statusCode: 400, statusMessage: 'end must be after start' })

  params.push(id)
  const rows = await query<{ date: string | Date }>(
    `UPDATE bookings SET ${sets.join(', ')} WHERE id = $${i} RETURNING date`,
    params
  )
  const iso = typeof rows[0].date === 'string' ? rows[0].date.slice(0, 10) : isoDate(rows[0].date)
  broadcastToService('calendar', { type: 'booking-changed', date: iso })
  return { ok: true }
})

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
