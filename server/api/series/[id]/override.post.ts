import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { getUserFromEvent } from '~~/server/utils/auth'
import { userInGroup, getGroupLabel } from '~~/server/utils/groups'
import type { BookingResource, OrganizerType } from '~~/shared/types'

interface Body {
  date: string
  start: string
  end: string
  resource: BookingResource
  title: string
  organizerType: OrganizerType
  organizerName: string
  organizerId?: string | null
  note?: string
  createdBy?: string | null
}

const RESOURCES: BookingResource[] = ['small', 'big', 'studio']
const ORGANIZERS: OrganizerType[] = ['person', 'ministry', 'church']

// Создаёт разовую бронь на конкретную дату и добавляет exception для серии,
// чтобы виртуальная в этот день не отображалась. Это даёт «изменить только
// эту дату» без затрагивания всей серии.
export default defineEventHandler(async (event) => {
  const seriesId = getRouterParam(event, 'id')
  if (!seriesId) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<Body>(event)

  // -------- Права --------
  const me = await getUserFromEvent(event)
  if (!me) {
    throw createError({ statusCode: 401, statusMessage: 'переопределять серию могут только зарегистрированные пользователи' })
  }
  {
    const cur = await query<{ organizer_type: string; organizer_id: string | null }>(
      `SELECT organizer_type, organizer_id FROM booking_series WHERE id = $1`,
      [seriesId]
    )
    const org = cur[0]
    const wasChurch = org?.organizer_type === 'church'
    const becomesChurch = body.organizerType === 'church'
    if ((wasChurch || becomesChurch) && !me.isAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'переопределение серии от имени церкви доступно только администратору' })
    }
    if (!me.isAdmin && org?.organizer_type === 'ministry') {
      if (!org.organizer_id || !(await userInGroup(me.id, org.organizer_id))) {
        throw createError({ statusCode: 403, statusMessage: 'эта серия принадлежит служению, в котором вы не состоите' })
      }
    }
    if (!me.isAdmin && body.organizerType === 'ministry') {
      if (!body.organizerId || !(await userInGroup(me.id, body.organizerId))) {
        throw createError({ statusCode: 403, statusMessage: 'нельзя переопределить от имени служения, в котором вы не состоите' })
      }
    }
  }

  const date = (body?.date || '').trim()
  const start = (body?.start || '').trim()
  const end = (body?.end || '').trim()
  const title = (body?.title || '').trim()
  const organizerName = (body?.organizerName || '').trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw createError({ statusCode: 400, statusMessage: 'date required' })
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) throw createError({ statusCode: 400, statusMessage: 'time required' })
  if (start >= end) throw createError({ statusCode: 400, statusMessage: 'end must be after start' })
  if (!RESOURCES.includes(body.resource)) throw createError({ statusCode: 400, statusMessage: 'resource required' })
  if (!ORGANIZERS.includes(body.organizerType)) throw createError({ statusCode: 400, statusMessage: 'organizerType required' })
  if (!title) throw createError({ statusCode: 400, statusMessage: 'title required' })
  if (!organizerName) throw createError({ statusCode: 400, statusMessage: 'organizerName required' })

  // Убедимся, что серия существует и активна.
  const s = await query<{ id: string }>(
    `SELECT id FROM booking_series WHERE id = $1 AND deleted_at IS NULL`,
    [seriesId]
  )
  if (!s.length) throw createError({ statusCode: 404, statusMessage: 'series not found' })

  // Нормализуем organizerName: для ministry — берём label из БД.
  let finalOrganizerName = organizerName
  if (body.organizerType === 'ministry' && body.organizerId) {
    const label = await getGroupLabel(body.organizerId)
    if (label) finalOrganizerName = label
  }

  const id = 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  await query('BEGIN')
  try {
    await query(
      `INSERT INTO bookings
         (id, date, start_time, end_time, resource, title,
          organizer_type, organizer_name, organizer_id, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id, date, start, end, body.resource, title,
        body.organizerType, finalOrganizerName, body.organizerId ?? null,
        body.note ?? '', body.createdBy ?? null,
      ]
    )
    await query(
      `INSERT INTO booking_exceptions (series_id, date)
       VALUES ($1, $2)
       ON CONFLICT (series_id, date) DO NOTHING`,
      [seriesId, date]
    )
    await query('COMMIT')
  } catch (e) {
    await query('ROLLBACK')
    throw e
  }

  broadcastToService('calendar', { type: 'booking-changed', date })
  return { id }
})
