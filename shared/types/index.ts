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
  day: DayKey
  outfit: string
  checks: Record<string, CheckEntry>
}

export interface RecentService {
  id: string
  date: string
  day: DayKey
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------
export interface WsHello {
  type: 'hello'
  clientId: string
}
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
  day: DayKey
  outfit: string
}
export interface WsPresence {
  type: 'presence'
  serviceId: string
  count: number
}
export interface WsError {
  type: 'error'
  message: string
}
export type WsServerMessage =
  | WsHello | WsCheckUpdate | WsServiceMetaUpdate | WsPresence | WsError
export type WsClientMessage = WsSubscribe
