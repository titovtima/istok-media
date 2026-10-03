import { getUserFromEvent, listSessions, getSessionTokenFromEvent } from '~~/server/utils/auth'

export interface SessionItem {
  id: string          // это token (или его префикс — но пусть будет целиком, httpOnly cookie)
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

export default defineEventHandler(async (event): Promise<SessionItem[]> => {
  const me = await getUserFromEvent(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'нужно войти' })

  const currentToken = getSessionTokenFromEvent(event)
  const rows = await listSessions(me.id)

  return rows.map(r => ({
    id: r.token,
    userAgent: r.user_agent,
    ip: r.ip,
    createdAt: r.created_at.toISOString(),
    lastSeenAt: r.last_seen_at.toISOString(),
    expiresAt: r.expires_at.toISOString(),
    current: r.token === currentToken,
  }))
})
