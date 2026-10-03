import { query } from '~~/server/utils/db'
import { broadcastToService } from '~~/server/utils/ws-hub'
import { parseServiceId, resolveServiceId } from '~~/server/utils/services'
import { getUserFromEvent } from '~~/server/utils/auth'
import { anonActorFromName, displayNameSync, isAnonActor } from '~~/server/utils/actor'

interface Body {
  templateId: string
  done: boolean
  actor?: string
  displayName?: string
  at?: string | null
}

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId) throw createError({ statusCode: 400, statusMessage: 'serviceId required' })
  const parsed = parseServiceId(rawId)
  if (!parsed) throw createError({ statusCode: 400, statusMessage: 'invalid id format' })

  const body = await readBody<Body>(event)
  if (!body?.templateId) throw createError({ statusCode: 400, statusMessage: 'templateId required' })

  const me = await getUserFromEvent(event)

  let actor = ''
  if (me) {
    const dn = (body?.displayName || '').trim()
    if (dn && dn !== me.fullName) actor = anonActorFromName(dn)
    else actor = me.login
  } else {
    const dn = (body?.displayName || '').trim()
    if (dn) actor = anonActorFromName(dn)
    else if (body?.actor) actor = body.actor.trim()
  }
  if (!actor) throw createError({ statusCode: 400, statusMessage: 'actor required' })

  let displayName = displayNameSync(actor)
  if (!isAnonActor(actor)) {
    const r = await query<{ full_name: string }>(`SELECT full_name FROM users WHERE login = $1`, [actor])
    displayName = r[0]?.full_name || actor
  }

  const existing = await resolveServiceId(rawId)
  const serviceId = existing ? existing.id : rawId

  await query(
    `INSERT INTO services (id, date, slot) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [serviceId, parsed.date, parsed.slot]
  )

  const rows = await query<{ updated_at: Date }>(
    `INSERT INTO checks (service_id, template_id, done, by_actor, at_label, updated_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (service_id, template_id) DO UPDATE
       SET done = EXCLUDED.done,
           by_actor = EXCLUDED.by_actor,
           at_label = EXCLUDED.at_label,
           updated_at = now()
     RETURNING updated_at`,
    [serviceId, body.templateId, !!body.done, actor, body.at ?? null]
  )

  const updatedAt = rows[0]?.updated_at instanceof Date
    ? rows[0].updated_at.toISOString()
    : new Date().toISOString()

  broadcastToService(serviceId, {
    type: 'check-update',
    serviceId,
    templateId: body.templateId,
    done: !!body.done,
    by: displayName,
    byActor: actor,
    at: body.at ?? null,
    updatedAt,
  })

  return { ok: true }
})
