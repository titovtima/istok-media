import { query } from '~~/server/utils/db'
import { requireAdmin } from '~~/server/utils/auth'
import type { AuthUser } from '~~/shared/types'

interface Body { isAdmin: boolean }

export default defineEventHandler(async (event): Promise<AuthUser> => {
  const me = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const body = await readBody<Body>(event)
  if (typeof body?.isAdmin !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'isAdmin (boolean) required' })
  }

  if (id === me.id && !body.isAdmin) {
    const others = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM users WHERE is_admin = true AND id <> $1`,
      [me.id]
    )
    if ((others[0]?.n ?? 0) === 0) {
      throw createError({ statusCode: 400, statusMessage: 'нельзя снять последнего администратора' })
    }
  }

  const rows = await query<{ id: string; email: string; login: string; full_name: string; is_admin: boolean }>(
    `UPDATE users SET is_admin = $1, updated_at = now()
      WHERE id = $2
      RETURNING id, email, login, full_name, is_admin`,
    [body.isAdmin, id]
  )
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'пользователь не найден' })

  const u = rows[0]
  return { id: u.id, email: u.email, login: u.login, fullName: u.full_name, isAdmin: !!u.is_admin }
})
