import { getUserFromEvent, revokeSession, getSessionTokenFromEvent } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const me = await getUserFromEvent(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'нужно войти' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  // Нельзя «выйти из текущей» этим методом — для этого /logout.
  const currentToken = getSessionTokenFromEvent(event)
  if (id === currentToken) {
    throw createError({ statusCode: 400, statusMessage: 'для текущей сессии используйте «выйти»' })
  }

  await revokeSession(me.id, id)
  return { ok: true }
})
