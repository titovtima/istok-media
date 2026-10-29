import { randomBytes } from 'node:crypto'
import { query } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { userInGroup, groupExists } from '~~/server/utils/groups'
import type { RoleItem } from '~~/shared/types'

interface Body { label: string }

// Создать роль в группе может любой участник группы или админ.
export default defineEventHandler(async (event): Promise<RoleItem> => {
  const me = await requireUser(event)
  const groupId = getRouterParam(event, 'id')
  if (!groupId) throw createError({ statusCode: 400, statusMessage: 'group id required' })

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

  const id = 'r_' + randomBytes(6).toString('base64url')

  const rows = await query<{ id: string; label: string }>(
    `INSERT INTO group_roles (id, group_id, label)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, label) DO NOTHING
     RETURNING id, label`,
    [id, groupId, label]
  )

  if (!rows.length) {
    // Уже есть роль с таким label — вернём её.
    const existing = await query<{ id: string; label: string }>(
      `SELECT id, label FROM group_roles WHERE group_id = $1 AND label = $2`,
      [groupId, label]
    )
    if (existing.length) return { id: existing[0].id, label: existing[0].label }
    throw createError({ statusCode: 409, statusMessage: 'такая роль уже есть' })
  }

  return { id: rows[0].id, label: rows[0].label }
})
