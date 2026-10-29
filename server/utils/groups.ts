import { query } from './db'
import type { Group, GroupMember } from '~~/shared/types'

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

  return groups.map(g => ({
    id: g.id,
    label: g.label,
    position: g.position,
    members: byGroup.get(g.id) ?? [],
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
