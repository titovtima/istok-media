import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { getUserFromEvent } from '~~/server/utils/auth'

// Разовые брони удаляем из БД полностью — не оставляем следов «отменено».
// Отметки присутствия по ним тоже чистим: ключ события — 'booking:<id>'.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  // -------- Права --------
  const me = await getUserFromEvent(event)
  if (!me) {
    throw createError({ statusCode: 401, statusMessage: 'удалять брони могут только зарегистрированные пользователи' })
  }
  {
    const cur = await query<{ organizer_type: string }>(
      `SELECT organizer_type FROM bookings WHERE id = $1`,
      [id]
    )
    if (cur[0]?.organizer_type === 'church' && !me.isAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'бронь от имени церкви может удалять только администратор' })
    }
  }
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const rows = await query<{ date: string | Date }>(
    `DELETE FROM bookings WHERE id = $1 RETURNING date`,
    [id]
  )

  // Удаляем attendance (даже если брони не было — безопасно и просто)
  await query(
    `DELETE FROM attendance WHERE event_key = $1`,
    [`booking:${id}`]
  )

  if (rows.length) {
    const iso = typeof rows[0].date === 'string' ? rows[0].date.slice(0, 10) : isoDate(rows[0].date)
    broadcastToService('calendar', { type: 'booking-changed', date: iso })
  } else {
    // Брони уже не было — на всякий случай обновим клиентов
    broadcastToService('calendar', { type: 'booking-changed', date: '' })
  }

  return { ok: true }
})

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
