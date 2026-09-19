import { query } from '~~/server/utils/db'
import type { TemplateItem } from '~~/shared/types'

interface Body { grp?: string; label?: string }

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<Body>(event)

  const sets: string[] = []
  const params: any[] = []
  let i = 1
  if (body.grp !== undefined) { sets.push(`grp = $${i++}`); params.push(body.grp.trim() || 'Без группы') }
  if (body.label !== undefined) { sets.push(`label = $${i++}`); params.push(body.label.trim()) }
  if (!sets.length) throw createError({ statusCode: 400, statusMessage: 'nothing to update' })
  sets.push(`updated_at = now()`)
  params.push(id)

  const rows = await query<TemplateItem>(
    `UPDATE templates SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING id, module, grp, label, position`,
    params
  )
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return rows[0]
})
