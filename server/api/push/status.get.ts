import { query } from '~~/server/utils/db'
import { getUserFromEvent } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const me = await getUserFromEvent(event)
  if (!me) return { subscribed: false }
  const rows = await query<{ id: string }>(
    `SELECT id FROM push_subscriptions WHERE user_id = $1 LIMIT 1`,
    [me.id]
  )
  return { subscribed: rows.length > 0 }
})
