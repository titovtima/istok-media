import { getUserFromEvent } from '~~/server/utils/auth'
import type { AuthUser } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<AuthUser | null> => {
  return await getUserFromEvent(event)
})
