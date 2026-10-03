import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { getUserFromEvent } from '~~/server/utils/auth'
import { anonActorFromName, displayNameSync, isAnonActor } from '~~/server/utils/actor'
import type { AttendanceStatus } from '~~/shared/types'

interface Body {
  eventKey: string
  // Кто: либо сервер сам выведет из auth-сессии, либо — если не залогинен —
  // клиент присылает actor ('anon:<имя>') или пару displayName + clientId.
  actor?: string
  displayName?: string          // для сбора actor, если он не передан
  status: AttendanceStatus | null
}

const ALLOWED: AttendanceStatus[] = ['yes', 'no', 'maybe']

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const eventKey = (body?.eventKey || '').trim()
  if (!eventKey) throw createError({ statusCode: 400, statusMessage: 'eventKey required' })

  const me = await getUserFromEvent(event)

  // Определяем actor.
  //   • залогинен и override имени пуст → login
  //   • залогинен, но в поле другое имя → 'anon:<имя>' (разовая отметка «за кого-то»)
  //   • не залогинен → 'anon:<имя>' из поля
  let actor = ''
  if (me) {
    const dn = (body?.displayName || '').trim()
    if (dn && dn !== me.fullName) actor = anonActorFromName(dn)
    else actor = me.login
  } else {
    const dn = (body?.displayName || '').trim()
    if (dn) actor = anonActorFromName(dn)
    else if (body?.actor) actor = body.actor.trim()
  }
  if (!actor) throw createError({ statusCode: 400, statusMessage: 'actor required' })

  // Вычисляем displayName для broadcast.
  let displayName = displayNameSync(actor)
  if (!isAnonActor(actor)) {
    const row = await query<{ full_name: string }>(
      `SELECT full_name FROM users WHERE login = $1`,
      [actor]
    )
    displayName = row[0]?.full_name || actor
  }

  // Снятие
  if (body.status === null) {
    await query(
      `DELETE FROM attendance WHERE event_key = $1 AND actor = $2`,
      [eventKey, actor]
    )
    broadcastToService('calendar', {
      type: 'attendance-changed',
      eventKey, actor, displayName, status: null,
    })
    return { ok: true }
  }

  if (!ALLOWED.includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid status' })
  }

  await query(
    `INSERT INTO attendance (event_key, actor, status, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (event_key, actor) DO UPDATE
       SET status = EXCLUDED.status,
           updated_at = now()`,
    [eventKey, actor, body.status]
  )

  broadcastToService('calendar', {
    type: 'attendance-changed',
    eventKey, actor, displayName, status: body.status,
  })
  return { ok: true }
})
