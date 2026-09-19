import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'

interface Body {
  resolved: boolean
  resolvedBy?: string | null
  resolvedAt?: string | null
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const body = await readBody<Body>(event)
  if (typeof body?.resolved !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'resolved (boolean) required' })
  }

  const resolvedBy = body.resolved ? (body.resolvedBy ?? null) : null
  const resolvedAt = body.resolved ? (body.resolvedAt ?? null) : null

  const rows = await query<{ id: string }>(
    `UPDATE feedback
        SET resolved = $1,
            resolved_by = $2,
            resolved_at = $3,
            updated_at = now()
      WHERE id = $4
      RETURNING id`,
    [body.resolved, resolvedBy, resolvedAt, id]
  )
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'not found' })

  broadcastToService('feedback', {
    type: 'feedback-updated',
    id,
    resolved: body.resolved,
    resolvedBy,
    resolvedAt,
  })

  return { ok: true }
})
