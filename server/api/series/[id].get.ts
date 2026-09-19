import { query } from '~~/server/utils/db'
import type { BookingResource, OrganizerType, SeriesRepeat } from '~~/shared/types'

interface Row {
  id: string
  weekday: number
  start_time: string
  end_time: string
  resource: BookingResource
  title: string
  organizer_type: OrganizerType
  organizer_name: string
  organizer_id: string | null
  note: string
  repeat: SeriesRepeat
  anchor_date: string
}

export default defineEventHandler(async (event): Promise<Row | null> => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const rows = await query<Row>(
    `SELECT id, weekday, start_time, end_time, resource, title,
            organizer_type, organizer_name, organizer_id, note,
            repeat, anchor_date::text AS anchor_date
       FROM booking_series
      WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  if (!rows.length) return null
  const r = rows[0]
  return {
    ...r,
    start_time: r.start_time.slice(0, 5),
    end_time: r.end_time.slice(0, 5),
  }
})
