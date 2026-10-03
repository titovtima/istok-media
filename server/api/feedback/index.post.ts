import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { getUserFromEvent } from '~~/server/utils/auth'
import { anonActorFromName, displayNameSync, isAnonActor } from '~~/server/utils/actor'
import type { FeedbackEntry, FeedbackService } from '~~/shared/types'
import { formatShort } from './index.get'

interface Body {
  name: string                  // display name — используется, если аноним
  service: FeedbackService
  otherNote?: string
  description: string
  actor?: string
}

const ALLOWED: FeedbackService[] = ['vosslavlenie','poryadok','uborka','media','other']

export default defineEventHandler(async (event): Promise<FeedbackEntry> => {
  const body = await readBody<Body>(event)
  const name = (body?.name || '').trim()
  const description = (body?.description || '').trim()
  const otherNote = (body?.otherNote || '').trim()
  const service = body?.service

  if (!description) throw createError({ statusCode: 400, statusMessage: 'description required' })
  if (!service || !ALLOWED.includes(service)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid service' })
  }

  const me = await getUserFromEvent(event)

  let actor = ''
  if (me) {
    // если вошёл и не override — login; иначе anon:<имя>
    if (name && name !== me.fullName) actor = anonActorFromName(name)
    else actor = me.login
  } else {
    if (name) actor = anonActorFromName(name)
    else if (body?.actor) actor = body.actor.trim()
  }
  if (!actor) throw createError({ statusCode: 400, statusMessage: 'actor required' })

  let displayName = displayNameSync(actor)
  if (!isAnonActor(actor)) {
    const r = await query<{ full_name: string }>(`SELECT full_name FROM users WHERE login = $1`, [actor])
    displayName = r[0]?.full_name || actor
  }

  const id = 'fb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  const rows = await query<{
    id: string; author_login: string; service: FeedbackService;
    other_note: string; description: string; resolved: boolean;
    resolved_by: string | null; resolved_at: string | null; created_at: Date | string;
  }>(
    `INSERT INTO feedback (id, author_login, service, other_note, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, author_login, service, other_note, description,
               resolved, resolved_by, resolved_at, created_at`,
    [id, actor, service, otherNote, description]
  )

  const r = rows[0]
  const iso = typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString()
  const entry: FeedbackEntry = {
    id: r.id,
    authorLogin: r.author_login,
    authorName: displayName,
    service: r.service,
    otherNote: r.other_note,
    description: r.description,
    resolved: r.resolved,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at,
    createdAt: iso,
    createdLabel: formatShort(iso),
  }

  broadcastToService('feedback', { type: 'feedback-created', entry })
  return entry
})
