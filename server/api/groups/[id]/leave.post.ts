import { query } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'

// Выйти из группы может сам пользователь.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  await query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [id, me.id]
  )
  return { ok: true }
})
