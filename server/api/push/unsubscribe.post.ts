import { query } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

interface Body { endpoint: string }

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<Body>(event)
  if (!body?.endpoint) throw createError({ statusCode: 400, statusMessage: 'endpoint required' })

  await query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [me.id, body.endpoint]
  )
  return { ok: true }
})
