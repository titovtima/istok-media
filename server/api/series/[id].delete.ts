import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { getUserFromEvent } from '~~/server/utils/auth'
import { userInGroup } from '~~/server/utils/groups'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  // -------- Права --------
  const me = await getUserFromEvent(event)
  if (!me) {
    throw createError({ statusCode: 401, statusMessage: 'удалять серии могут только зарегистрированные пользователи' })
  }
  {
    const cur = await query<{ organizer_type: string; organizer_id: string | null }>(
      `SELECT organizer_type, organizer_id FROM booking_series WHERE id = $1`,
      [id]
    )
    const org = cur[0]
    if (!me.isAdmin && org) {
      if (org.organizer_type === 'church') {
        throw createError({ statusCode: 403, statusMessage: 'серию от имени церкви может удалять только администратор' })
      }
      if (org.organizer_type === 'ministry') {
        if (!org.organizer_id || !(await userInGroup(me.id, org.organizer_id))) {
          throw createError({ statusCode: 403, statusMessage: 'эта серия принадлежит служению, в котором вы не состоите' })
        }
      }
    }
  }
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  await query(
    `UPDATE booking_series
        SET deleted_at = now(), updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  // Broadкаст без конкретной даты — фронт перезагрузит весь видимый диапазон.
  broadcastToService('calendar', { type: 'booking-changed', date: '' })
  return { ok: true }
})
