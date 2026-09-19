import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import type { AttendanceStatus } from '~~/shared/types'

interface Body {
  eventKey: string
  name: string
  clientId?: string | null
  status: AttendanceStatus | null
}

const ALLOWED: AttendanceStatus[] = ['yes', 'no', 'maybe']

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const eventKey = (body?.eventKey || '').trim()
  const name = (body?.name || '').trim()
  const clientId = (body?.clientId || '').trim() || null

  if (!eventKey) throw createError({ statusCode: 400, statusMessage: 'eventKey required' })
  if (!name) throw createError({ statusCode: 400, statusMessage: 'name required' })

  // Снять отметку — DELETE по (event_key, name).
  if (body.status === null) {
    await query(
      `DELETE FROM attendance WHERE event_key = $1 AND name = $2`,
      [eventKey, name]
    )
    broadcastToService('calendar', {
      type: 'attendance-changed',
      eventKey,
      name,
      clientId,
      status: null,
    })
    return { ok: true }
  }

  if (!ALLOWED.includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid status' })
  }

  await query(
    `INSERT INTO attendance (event_key, name, client_id, status, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (event_key, name) DO UPDATE
       SET client_id = EXCLUDED.client_id,
           status = EXCLUDED.status,
           updated_at = now()`,
    [eventKey, name, clientId, body.status]
  )

  broadcastToService('calendar', {
    type: 'attendance-changed',
    eventKey,
    name,
    clientId,
    status: body.status,
  })
  return { ok: true }
})
