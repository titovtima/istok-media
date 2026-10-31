import { query } from './db'
import { sendPushToUser, ensurePushConfigured } from './push'
import { expandSeriesDates, isoDate, parseISO, addDaysISO } from './events'
import type { SeriesRow } from './events'

let timer: NodeJS.Timeout | null = null
let running = false

const CHECK_INTERVAL_MS = 60 * 60 * 1000
const WINDOW_MIN = 23
const WINDOW_MAX = 25

export function startPushScheduler() {
  if (timer) return
  if (!ensurePushConfigured()) {
    console.warn('[push-scheduler] push is not configured — scheduler disabled')
    return
  }

  setTimeout(() => { runOnce().catch(e => console.error(e)) }, 10_000)

  timer = setInterval(() => {
    runOnce().catch(e => console.error(e))
  }, CHECK_INTERVAL_MS)

  console.log('[push-scheduler] started')
}

export async function runOnce() {
  if (running) return
  running = true
  try {
    await processDueEvents()
  } finally {
    running = false
  }
}

// Одно предстоящее событие: единица работы для отправки push.
interface DueEvent {
  eventKey: string
  date: string                  // YYYY-MM-DD
  startTime: string             // HH:MM
  title: string
  organizerType: 'ministry' | 'church'
  organizerId: string | null
}

async function collectDueEvents(now: Date): Promise<DueEvent[]> {
  const out: DueEvent[] = []
  const from = isoDate(now)
  const to = addDaysISO(isoDate(now), 2)

  // --- Разовые брони (bookings) ---
  const rows = await query<{
    id: string
    date: Date | string
    start_time: string
    title: string
    organizer_type: 'ministry' | 'church'
    organizer_id: string | null
  }>(
    `SELECT id, date, start_time::text AS start_time, title, organizer_type, organizer_id
       FROM bookings
      WHERE cancelled_at IS NULL
        AND organizer_type IN ('ministry', 'church')
        AND date >= $1 AND date <= $2`,
    [from, to]
  )

  for (const r of rows) {
    const dateStr = typeof r.date === 'string' ? r.date.slice(0, 10) : isoDate(r.date)
    const eventKey = `booking:${r.id}`
    out.push({
      eventKey,
      date: dateStr,
      startTime: r.start_time.slice(0, 5),
      title: r.title,
      organizerType: r.organizer_type,
      organizerId: r.organizer_id,
    })
  }

  // --- Серии (booking_series) ---
  const series = await query<SeriesRow>(
    `SELECT id, weekday, start_time::text AS start_time, end_time::text AS end_time,
            resource, title, organizer_type, organizer_name, organizer_id, note,
            repeat, anchor_date::text AS anchor_date, deleted_at, created_by
       FROM booking_series
      WHERE deleted_at IS NULL
        AND organizer_type IN ('ministry', 'church')`,
  )

  // Исключения (отменённые на дату) — соберём разом.
  const seriesIds = series.map(s => s.id)
  const cancelledBySeries = new Map<string, Set<string>>()
  if (seriesIds.length) {
    const placeholders = seriesIds.map((_, i) => `$${i + 1}`).join(', ')
    const exc = await query<{ series_id: string; date: string | Date }>(
      `SELECT series_id, date FROM booking_exceptions WHERE series_id IN (${placeholders})`,
      seriesIds,
    )
    for (const e of exc) {
      const iso = typeof e.date === 'string' ? e.date.slice(0, 10) : isoDate(e.date)
      if (!cancelledBySeries.has(e.series_id)) cancelledBySeries.set(e.series_id, new Set())
      cancelledBySeries.get(e.series_id)!.add(iso)
    }
  }

  for (const s of series) {
    const cancelled = cancelledBySeries.get(s.id) ?? new Set()
    const dates = expandSeriesDates(s, from, to, cancelled)
    for (const { date, cancelled: isCancelled } of dates) {
      if (isCancelled) continue
      out.push({
        eventKey: `series:${s.id}:${date}`,
        date,
        startTime: s.start_time.slice(0, 5),
        title: s.title,
        organizerType: s.organizer_type as 'ministry' | 'church',
        organizerId: s.organizer_id,
      })
    }
  }

  // Фильтр по времени: 23–25 часов до начала.
  const due = out.filter(e => {
    const d = parseISO(e.date)
    const [hh, mm] = e.startTime.split(':').map(Number)
    d.setHours(hh, mm, 0, 0)
    const hoursUntil = (d.getTime() - now.getTime()) / 3_600_000
    return hoursUntil >= WINDOW_MIN && hoursUntil <= WINDOW_MAX
  })

  return due
}

async function processDueEvents() {
  const now = new Date()
  const due = await collectDueEvents(now)
  if (!due.length) return

  for (const ev of due) {
    // Кому шлём.
    let recipients: { user_id: string; login: string }[] = []
    if (ev.organizerType === 'ministry' && ev.organizerId) {
      recipients = await query<{ user_id: string; login: string }>(
        `SELECT gm.user_id, u.login
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = $1`,
        [ev.organizerId]
      )
    } else if (ev.organizerType === 'church') {
      // Церковное мероприятие — шлём всем пользователям с подпиской.
      recipients = await query<{ user_id: string; login: string }>(
        `SELECT DISTINCT u.id AS user_id, u.login
           FROM users u
           JOIN push_subscriptions ps ON ps.user_id = u.id`,
      )
    }
    if (!recipients.length) continue

    // Кто уже отметился.
    const attended = await query<{ actor: string }>(
      `SELECT actor FROM attendance WHERE event_key = $1`,
      [ev.eventKey],
    )
    const attendedSet = new Set(attended.map(a => a.actor))

    // Кому уже отправляли.
    const alreadySent = await query<{ user_id: string }>(
      `SELECT user_id FROM push_notifications_sent WHERE event_key = $1`,
      [ev.eventKey],
    )
    const sentSet = new Set(alreadySent.map(x => x.user_id))

    for (const r of recipients) {
      if (sentSet.has(r.user_id)) continue
      if (attendedSet.has(r.login)) continue

      const count = await sendPushToUser(r.user_id, {
        title: 'Напоминание о мероприятии',
        body: `${ev.title} — ${ev.date}, ${ev.startTime}. Не забудьте отметить присутствие.`,
        url: '/calendar',
        tag: ev.eventKey,
      })

      // Помечаем как отправленное.
      await query(
        `INSERT INTO push_notifications_sent (event_key, user_id, date)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [ev.eventKey, r.user_id, ev.date],
      )

      if (count > 0) {
        console.log(`[push-scheduler] sent to ${r.login} for ${ev.eventKey}`)
      }
    }
  }
}
