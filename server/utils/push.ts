import webpush from 'web-push'
import { query } from './db'

const VAPID_PUBLIC = process.env.NUXT_PUSH_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.NUXT_PUSH_VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.NUXT_PUSH_VAPID_SUBJECT || 'mailto:admin@example.com'

let configured = false
export function ensurePushConfigured(): boolean {
  if (configured) return true
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push] VAPID keys are not set — push notifications disabled')
    return false
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensurePushConfigured()) return 0

  const subs = await query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  )

  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        JSON.stringify(payload),
      )
      sent++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await query(`DELETE FROM push_subscriptions WHERE id = $1`, [s.id])
      } else {
        console.error('[push] send failed:', e?.statusCode, e?.message)
      }
    }
  }
  return sent
}
