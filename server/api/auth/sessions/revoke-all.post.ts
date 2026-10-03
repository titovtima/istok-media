import { getUserFromEvent, revokeAllSessions, getSessionTokenFromEvent } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const me = await getUserFromEvent(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'нужно войти' })

  const currentToken = getSessionTokenFromEvent(event)
  const count = await revokeAllSessions(me.id, currentToken || undefined)
  return { ok: true, revoked: count }
})
