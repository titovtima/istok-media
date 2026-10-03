import { query } from '~~/server/utils/db'
import type { AuthUser } from '~~/shared/types'

interface Row {
  id: string; email: string; login: string; full_name: string; is_admin: boolean
}

export default defineEventHandler(async (): Promise<AuthUser[]> => {
  const rows = await query<Row>(
    `SELECT id, email, login, full_name, is_admin FROM users ORDER BY full_name, login`
  )
  return rows.map(r => ({
    id: r.id,
    email: r.email,
    login: r.login,
    fullName: r.full_name,
    isAdmin: !!r.is_admin,
  }))
})
