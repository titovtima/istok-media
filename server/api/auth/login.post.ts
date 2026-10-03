import { query } from '~~/server/utils/db'
import { verifyPassword, createSession, setSessionCookie } from '~~/server/utils/auth'
import type { AuthUser } from '~~/shared/types'

interface Body {
  login: string        // логин ИЛИ email
  password: string
}

export default defineEventHandler(async (event): Promise<AuthUser> => {
  const body = await readBody<Body>(event)
  const identifier = (body?.login || '').trim().toLowerCase()
  const password = body?.password || ''
  if (!identifier || !password) {
    throw createError({ statusCode: 400, statusMessage: 'заполните логин/email и пароль' })
  }

  const rows = await query<{
    id: string; email: string; login: string; full_name: string; password_hash: string; is_admin: boolean; is_admin: boolean; is_admin: boolean
  }>(
    `SELECT id, email, login, full_name, password_hash, is_admin, is_admin, is_admin
       FROM users
      WHERE login = $1 OR email = $1
      LIMIT 1`,
    [identifier]
  )
  if (!rows.length) {
    throw createError({ statusCode: 401, statusMessage: 'неверный логин/email или пароль' })
  }
  const u = rows[0]
  const ok = await verifyPassword(password, u.password_hash)
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: 'неверный логин/email или пароль' })
  }

  const { token, expiresAt } = await createSession(u.id, event)
  setSessionCookie(event, token, expiresAt)

  return { id: u.id, email: u.email, login: u.login, fullName: u.full_name, isAdmin: !!u.is_admin }
})
