import { query } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { userInGroup, groupExists } from '~~/server/utils/groups'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const groupId = getRouterParam(event, 'id')
  const roleId = getRouterParam(event, 'roleId')
  if (!groupId || !roleId) throw createError({ statusCode: 400, statusMessage: 'id required' })

  if (!(await groupExists(groupId))) {
    throw createError({ statusCode: 404, statusMessage: 'группа не найдена' })
  }
  if (!me.isAdmin) {
    const ok = await userInGroup(me.id, groupId)
    if (!ok) throw createError({ statusCode: 403, statusMessage: 'вы не участник этой группы' })
  }

  await query(`DELETE FROM group_roles WHERE id = $1 AND group_id = $2`, [roleId, groupId])
  return { ok: true }
})
