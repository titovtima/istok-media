import { deleteSession, clearSessionCookie, SESSION_COOKIE } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    await deleteSession(token)
  }
  clearSessionCookie(event)
  return { ok: true }
})
