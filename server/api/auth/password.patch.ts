import { query } from '~~/server/utils/db'
import {
  getUserFromEvent, getUserById, hashPassword, verifyPassword,
} from '~~/server/utils/auth'

interface Body {
  currentPassword: string
  newPassword: string
}

export default defineEventHandler(async (event) => {
  const me = await getUserFromEvent(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'не авторизован' })

  const body = await readBody<Body>(event)
  const currentPassword = body?.currentPassword || ''
  const newPassword = body?.newPassword || ''

  if (!currentPassword) throw createError({ statusCode: 400, statusMessage: 'введите текущий пароль' })
  if (newPassword.length < 6) throw createError({ statusCode: 400, statusMessage: 'новый пароль не короче 6 символов' })

  const full = await getUserById(me.id)
  if (!full) throw createError({ statusCode: 404, statusMessage: 'пользователь не найден' })

  const ok = await verifyPassword(currentPassword, full.passwordHash)
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'текущий пароль неверен' })

  const newHash = await hashPassword(newPassword)
  await query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [newHash, me.id]
  )
  // Сессии не трогаем — текущая сессия продолжает работать.
  return { ok: true }
})
