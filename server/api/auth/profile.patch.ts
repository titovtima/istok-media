import { query } from '~~/server/utils/db'
import { getUserFromEvent, validateEmail } from '~~/server/utils/auth'
import type { AuthUser } from '~~/shared/types'

interface Body {
  fullName?: string
  email?: string
}

export default defineEventHandler(async (event): Promise<AuthUser> => {
  const me = await getUserFromEvent(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'не авторизован' })

  const body = await readBody<Body>(event)
  const sets: string[] = []
  const params: any[] = []
  let i = 1

  if (body.fullName !== undefined) {
    const fullName = body.fullName.trim()
    if (!fullName) throw createError({ statusCode: 400, statusMessage: 'укажите полное имя' })
    sets.push(`full_name = $${i++}`)
    params.push(fullName)
  }

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase()
    if (!validateEmail(email)) throw createError({ statusCode: 400, statusMessage: 'некорректный email' })

    // Уникальность email среди других пользователей
    const dup = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 AND id <> $2`,
      [email, me.id]
    )
    if (dup.length) throw createError({ statusCode: 409, statusMessage: 'этот email уже используется' })

    sets.push(`email = $${i++}`)
    params.push(email)
  }

  if (!sets.length) return me

  sets.push(`updated_at = now()`)
  params.push(me.id)

  const rows = await query<{ id: string; email: string; login: string; full_name: string; is_admin: boolean }>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING id, email, login, full_name, is_admin, is_admin, is_admin`,
    params
  )
  const u = rows[0]
  return { id: u.id, email: u.email, login: u.login, fullName: u.full_name, isAdmin: !!u.is_admin }
})
