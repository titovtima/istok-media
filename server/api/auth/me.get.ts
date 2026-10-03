import {
  getUserFromEvent, touchSession, setSessionCookie, getSessionTokenFromEvent,
  SESSION_TTL_DAYS,
} from '~~/server/utils/auth'
import type { AuthUser } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<AuthUser | null> => {
  const user = await getUserFromEvent(event)
  if (!user) return null

  // Скользящий TTL: если до истечения меньше 7 дней — продлим и обновим cookie.
  const token = getSessionTokenFromEvent(event)
  if (token) {
    try {
      const { newExpiresAt } = await touchSession(token)
      if (newExpiresAt) setSessionCookie(event, token, newExpiresAt)
    } catch { /* не критично */ }
  }

  return user
})
