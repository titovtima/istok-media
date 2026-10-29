import { query } from './db'
import type { Group, GroupMember, RoleItem } from '~~/shared/types'

export async function userInGroup(userId: string, groupId: string): Promise<boolean> {
  const rows = await query<{ one: number }>(
    `SELECT 1 AS one FROM group_members WHERE user_id = $1 AND group_id = $2 LIMIT 1`,
    [userId, groupId]
  )
  return rows.length > 0
}

export async function groupExists(groupId: string): Promise<boolean> {
  const rows = await query<{ one: number }>(
    `SELECT 1 AS one FROM groups WHERE id = $1 LIMIT 1`,
    [groupId]
  )
  return rows.length > 0
}

export async function listGroupsWithMembers(): Promise<Group[]> {
  const groups = await query<{ id: string; label: string; position: number }>(
    `SELECT id, label, position FROM groups ORDER BY position, label`
  )
  if (!groups.length) return []

  const ids = groups.map(g => g.id)
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  const members = await query<{
    group_id: string
    user_id: string
    full_name: string
    login: string
    joined_at: Date
  }>(
    `SELECT gm.group_id, gm.user_id, u.full_name, u.login, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id IN (${placeholders})
      ORDER BY u.full_name`,
    ids
  )

  const byGroup = new Map<string, GroupMember[]>()
  for (const m of members) {
    if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, [])
    byGroup.get(m.group_id)!.push({
      userId: m.user_id,
      fullName: m.full_name,
      login: m.login,
      joinedAt: m.joined_at.toISOString(),
    })
  }

  // Роли по всем группам одним запросом.
  const roles = await query<{ id: string; group_id: string; label: string }>(
    `SELECT id, group_id, label FROM group_roles
      WHERE group_id IN (${placeholders})
      ORDER BY label`,
    ids,
  )
  const rolesByGroup = new Map<string, RoleItem[]>()
  for (const r of roles) {
    if (!rolesByGroup.has(r.group_id)) rolesByGroup.set(r.group_id, [])
    rolesByGroup.get(r.group_id)!.push({ id: r.id, label: r.label })
  }

  return groups.map(g => ({
    id: g.id,
    label: g.label,
    position: g.position,
    members: byGroup.get(g.id) ?? [],
    roles: rolesByGroup.get(g.id) ?? [],
  }))
}

// Получить название группы по её id (для нормализации organizer_name).
export async function getGroupLabel(groupId: string): Promise<string | null> {
  const rows = await query<{ label: string }>(
    `SELECT label FROM groups WHERE id = $1`,
    [groupId]
  )
  return rows[0]?.label ?? null
}

// Для списка actor'ов возвращает map actor → массив group_id.
// Для anon:<...> — пустой массив.
export async function resolveActorGroups(actors: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  const logins: string[] = []
  for (const a of actors) {
    if (!a) continue
    if (a.startsWith('anon:')) {
      result.set(a, [])
    } else {
      logins.push(a)
    }
  }
  if (!logins.length) return result

  const placeholders = logins.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await query<{ login: string; group_id: string }>(
    `SELECT u.login, gm.group_id
       FROM users u
       JOIN group_members gm ON gm.user_id = u.id
      WHERE u.login IN (${placeholders})`,
    logins
  )
  const map = new Map<string, string[]>()
  for (const r of rows) {
    if (!map.has(r.login)) map.set(r.login, [])
    map.get(r.login)!.push(r.group_id)
  }
  for (const l of logins) {
    result.set(l, map.get(l) ?? [])
  }
  return result
}
