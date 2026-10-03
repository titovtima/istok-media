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
  byActor: string | null     // actor того, кто поставил последним
  by: string | null          // displayName, вычислен сервером
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
  authorLogin: string        // actor
  authorName: string         // displayName, вычислено сервером
  service: FeedbackService
  otherNote: string
  description: string
  resolved: boolean
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
  createdLabel: string
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
  byActor: string | null
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


export interface WsServiceDeleted {
  type: 'service-deleted'
  serviceId: string
  date: string
  slot: number
}

export interface WsDateServicesChanged {
  type: 'date-services-changed'
  date: string
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


// ---------------------------------------------------------------------------
// Бронирование залов
// ---------------------------------------------------------------------------
export type BookingResource = 'small' | 'big' | 'studio'
export type OrganizerType = 'person' | 'ministry' | 'church'
export type SeriesRepeat = 'weekly' | 'biweekly'
export type AttendanceStatus = 'yes' | 'no' | 'maybe'

export interface BookingRecord {
  id: string                 // для series-развёрток: 'series:<seriesId>:<date>'
  seriesId: string | null    // null для разовых
  date: string               // YYYY-MM-DD
  start: string              // HH:MM
  end: string                // HH:MM
  resource: BookingResource
  title: string
  organizerType: OrganizerType
  organizerName: string
  organizerId: string | null
  note: string
  cancelled: boolean         // отменено (для series-развёртки — на конкретную дату)
  cancelledSeries?: boolean  // вся серия отменена — показываем только для инфо
  createdBy?: string | null
}

export interface AttendanceRecord {
  actor: string             // user.login или 'anon:<имя>'
  displayName: string       // вычислено сервером: full_name или имя без префикса
  status: AttendanceStatus
}

export interface AttendanceSummary {
  yes: AttendanceRecord[]
  no: AttendanceRecord[]
  maybe: AttendanceRecord[]
  // статус текущего пользователя (по viewerName + clientId)
  mine: AttendanceStatus | null
}

export interface BookingWithAttendance extends BookingRecord {
  attendance: AttendanceSummary
}

// ---------------------------------------------------------------------------
// WebSocket — дополнительные типы
// ---------------------------------------------------------------------------
export interface WsBookingChanged {
  type: 'booking-changed'          // создана/обновлена/отменена бронь
  date: string                     // дата, которую надо перерисовать (YYYY-MM-DD)
}

export interface WsAttendanceChanged {
  type: 'attendance-changed'
  eventKey: string
  actor: string
  displayName: string        // вычислено сервером
  status: AttendanceStatus | null
}

export type WsServerMessage =
  | WsHello
  | WsCheckUpdate
  | WsServiceMetaUpdate
  | WsPresence
  | WsFeedbackCreated
  | WsFeedbackUpdated
  | WsBookingChanged
  | WsAttendanceChanged
  | WsError

// ---------------------------------------------------------------------------
// Пользователи
// ---------------------------------------------------------------------------
export interface AuthUser {
  id: string
  email: string
  login: string
  fullName: string
}
