import { query } from '~~/server/utils/db'
import { requireAdmin } from '~~/server/utils/auth'

// Админ может удалить участника из любой группы.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')
  if (!id || !userId) throw createError({ statusCode: 400, statusMessage: 'id and userId required' })

  await query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [id, userId]
  )
  return { ok: true }
})
