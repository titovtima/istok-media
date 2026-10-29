import { query } from '~~/server/utils/db'
import { requireAdmin } from '~~/server/utils/auth'
import type { Group } from '~~/shared/types'

interface Body { id: string; label: string; position?: number }

export default defineEventHandler(async (event): Promise<Group> => {
  await requireAdmin(event)

  const body = await readBody<Body>(event)
  const id = (body?.id || '').trim().toLowerCase()
  const label = (body?.label || '').trim()

  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'id: 2–32 символа, a–z, 0–9, _, -' })
  }
  if (!label) throw createError({ statusCode: 400, statusMessage: 'укажите название' })

  const dup = await query<{ one: number }>(
    `SELECT 1 AS one FROM groups WHERE id = $1 LIMIT 1`,
    [id]
  )
  if (dup.length) throw createError({ statusCode: 409, statusMessage: 'группа с таким id уже есть' })

  // позиция: в конец, если не задана
  let position = body.position
  if (typeof position !== 'number') {
    const maxRow = await query<{ max: number | null }>(
      `SELECT MAX(position) AS max FROM groups`
    )
    position = (maxRow[0]?.max ?? 0) + 1
  }

  await query(
    `INSERT INTO groups (id, label, position) VALUES ($1, $2, $3)`,
    [id, label, position]
  )

  return { id, label, position, members: [] }
})
