// ---------------------------------------------------------------------------
// Чек-лист
// ---------------------------------------------------------------------------
export type ModuleKey = 'tech'

export type DayKey =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday'

export interface TemplateItem {
  id: string
  module: ModuleKey
  grp: string
  label: string
  position: number
}

export interface CheckEntry {
  done: boolean
  by: string | null
  at: string | null
}

export interface ServiceRecord {
  id: string
  date: string
  slot: number
  outfit: string
  checks: Record<string, CheckEntry>
}

export interface RecentService {
  id: string
  date: string
  slot: number
}

// ---------------------------------------------------------------------------
// Обратная связь
// ---------------------------------------------------------------------------
export type FeedbackService = 'vosslavlenie' | 'poryadok' | 'uborka' | 'media' | 'other'

export interface FeedbackEntry {
  id: string
  name: string
  service: FeedbackService
  otherNote: string
  description: string
  resolved: boolean
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string      // ISO
  createdLabel: string   // "17.09 14:32"
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------
export interface WsHello {
  type: 'hello'
  clientId: string
}

// Клиент → сервер: подписка. serviceId может быть:
//   "checklist:<serviceId>"  — на комнату чек-листа
//   "feedback"               — общая комната обратной связи
export interface WsSubscribe {
  type: 'subscribe'
  serviceId: string
}

export interface WsCheckUpdate {
  type: 'check-update'
  serviceId: string
  templateId: string
  done: boolean
  by: string | null
  at: string | null
  updatedAt: string
}

export interface WsServiceMetaUpdate {
  type: 'service-meta-update'
  serviceId: string
  date: string
  outfit: string
}

export interface WsPresence {
  type: 'presence'
  serviceId: string
  count: number
}

export interface WsFeedbackCreated {
  type: 'feedback-created'
  entry: FeedbackEntry
}

export interface WsFeedbackUpdated {
  type: 'feedback-updated'
  id: string
  resolved: boolean
  resolvedBy: string | null
  resolvedAt: string | null
}

export interface WsError {
  type: 'error'
  message: string
}

export type WsServerMessage =
  | WsHello
  | WsCheckUpdate
  | WsServiceMetaUpdate
  | WsPresence
  | WsFeedbackCreated
  | WsFeedbackUpdated
  | WsError

export type WsClientMessage = WsSubscribe
