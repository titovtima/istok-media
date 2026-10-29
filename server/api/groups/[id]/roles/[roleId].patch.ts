import { query } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { userInGroup, groupExists } from '~~/server/utils/groups'
import type { RoleItem } from '~~/shared/types'

interface Body { label: string }

export default defineEventHandler(async (event): Promise<RoleItem> => {
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

  const body = await readBody<Body>(event)
  const label = (body?.label || '').trim()
  if (!label) throw createError({ statusCode: 400, statusMessage: 'укажите название' })
  if (label.length > 60) throw createError({ statusCode: 400, statusMessage: 'слишком длинное название' })

  const rows = await query<{ id: string; label: string }>(
    `UPDATE group_roles SET label = $1, updated_at = now()
      WHERE id = $2 AND group_id = $3
      RETURNING id, label`,
    [label, roleId, groupId]
  )
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'роль не найдена' })
  return { id: rows[0].id, label: rows[0].label }
})
