import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { getUserFromEvent } from '~~/server/utils/auth'
import { userInGroup } from '~~/server/utils/groups'

interface Body { date: string }

// Отменяет отмену конкретной даты. Записи в attendance НЕ трогаем —
// ключ события 'series:<seriesId>:<date>' остаётся, все отметки сохраняются.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  // -------- Права --------
  const me = await getUserFromEvent(event)
  if (!me) {
    throw createError({ statusCode: 401, statusMessage: 'нужно войти' })
  }
  {
    const cur = await query<{ organizer_type: string; organizer_id: string | null }>(
      `SELECT organizer_type, organizer_id FROM booking_series WHERE id = $1`,
      [id]
    )
    const org = cur[0]
    if (!me.isAdmin && org) {
      if (org.organizer_type === 'church') {
        throw createError({ statusCode: 403, statusMessage: 'только администратор может менять серию от имени церкви' })
      }
      if (org.organizer_type === 'ministry') {
        if (!org.organizer_id || !(await userInGroup(me.id, org.organizer_id))) {
          throw createError({ statusCode: 403, statusMessage: 'эта серия принадлежит служению, в котором вы не состоите' })
        }
      }
    }
  }
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<Body>(event)
  if (!body?.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({ statusCode: 400, statusMessage: 'date required' })
  }

  await query(
    `DELETE FROM booking_exceptions WHERE series_id = $1 AND date = $2`,
    [id, body.date]
  )
  broadcastToService('calendar', { type: 'booking-changed', date: body.date })
  return { ok: true }
})
