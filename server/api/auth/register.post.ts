import { query } from '~~/server/utils/db'
import {
  hashPassword, newId, createSession, setSessionCookie,
  validateEmail, validateLogin,
} from '~~/server/utils/auth'
import type { AuthUser } from '~~/shared/types'

interface Body {
  fullName: string
  login: string
  email: string
  password: string
}

export default defineEventHandler(async (event): Promise<AuthUser> => {
  const body = await readBody<Body>(event)
  const fullName = (body?.fullName || '').trim()
  const login = (body?.login || '').trim().toLowerCase()
  const email = (body?.email || '').trim().toLowerCase()
  const password = body?.password || ''

  if (!fullName) throw createError({ statusCode: 400, statusMessage: 'укажите полное имя' })
  if (!validateLogin(login)) throw createError({ statusCode: 400, statusMessage: 'логин: 3–32 символа, a–z, 0–9, _, ., -' })
  if (!validateEmail(email)) throw createError({ statusCode: 400, statusMessage: 'укажите корректный email' })
  if (password.length < 6) throw createError({ statusCode: 400, statusMessage: 'пароль не короче 6 символов' })

  // Проверка уникальности (по отдельности, чтобы точнее сообщать)
  const dup = await query<{ login: string; email: string }>(
    `SELECT login, email FROM users WHERE login = $1 OR email = $2 LIMIT 1`,
    [login, email]
  )
  if (dup.length) {
    const d = dup[0]
    if (d.login === login) throw createError({ statusCode: 409, statusMessage: 'этот логин уже занят' })
    throw createError({ statusCode: 409, statusMessage: 'этот email уже зарегистрирован' })
  }

  const id = newId('u')
  const hash = await hashPassword(password)
  const rows = await query<{ id: string; email: string; login: string; full_name: string; is_admin: boolean }>(
    `INSERT INTO users (id, email, login, full_name, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, login, full_name, is_admin, is_admin, is_admin`,
    [id, email, login, fullName, hash]
  )
  const user = rows[0]

  const { token, expiresAt } = await createSession(user.id)
  setSessionCookie(event, token, expiresAt)

  return { id: user.id, email: user.email, login: user.login, fullName: user.full_name, isAdmin: !!user.is_admin }
})
