import { query } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { groupExists } from '~~/server/utils/groups'

// Вступить может любой залогиненный. Идемпотентно.
// Даже если раньше админ удалял — вступление разрешено снова.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  if (!(await groupExists(id))) {
    throw createError({ statusCode: 404, statusMessage: 'группа не найдена' })
  }

  await query(
    `INSERT INTO group_members (group_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [id, me.id]
  )
  return { ok: true }
})
