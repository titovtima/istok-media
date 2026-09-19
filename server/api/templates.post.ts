import { query } from '~~/server/utils/db'
import type { TemplateItem } from '~~/shared/types'

interface Body { module: 'tech'; grp: string; label: string }

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (body?.module !== 'tech' || !body?.label?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'module=tech and label required' })
  }
  const grp = (body.grp || 'Без группы').trim()
  const id = 't_' + Date.now().toString(36)

  const maxRow = await query<{ max: number | null }>(
    `SELECT MAX(position) AS max FROM templates WHERE module = 'tech'`
  )
  const position = (maxRow[0]?.max ?? 0) + 1

  const rows = await query<TemplateItem>(
    `INSERT INTO templates (id, module, grp, label, position)
     VALUES ($1, 'tech', $2, $3, $4)
     RETURNING id, module, grp, label, position`,
    [id, grp, body.label.trim(), position]
  )
  return rows[0]
})
