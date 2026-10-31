import { randomBytes } from 'node:crypto'
import { query } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

interface Body {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<Body>(event)
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    throw createError({ statusCode: 400, statusMessage: 'invalid subscription' })
  }

  const id = 'ps_' + randomBytes(8).toString('base64url')

  await query(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth`,
    [id, me.id, body.endpoint, body.keys.p256dh, body.keys.auth]
  )
  return { ok: true }
})
