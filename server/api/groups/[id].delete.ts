import { query } from '~~/server/utils/db'
import { requireAdmin } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  // Проверка, есть ли брони с этим organizer_id. Не блокируем удаление,
  // но историю сохраняем — organizer_name в брони остаётся как снимок.
  await query(`DELETE FROM groups WHERE id = $1`, [id])
  return { ok: true }
})
