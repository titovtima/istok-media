import { query } from '~~/server/utils/db'
import type { TemplateItem } from '~~/shared/types'

export default defineEventHandler(async () => {
  const rows = await query<TemplateItem>(
    `SELECT id, module, grp, label, position
     FROM templates
     WHERE module = 'tech'
     ORDER BY position, id`
  )
  return { tech: rows }
})
