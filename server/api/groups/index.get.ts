import { listGroupsWithMembers } from '~~/server/utils/groups'
import type { Group } from '~~/shared/types'

// Список групп виден всем, включая неавторизованных.
export default defineEventHandler(async (): Promise<Group[]> => {
  return await listGroupsWithMembers()
})
