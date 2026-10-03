import { readonly, ref } from 'vue'
import type { WsClientMessage, WsServerMessage } from '~~/shared/types'

type Handler = (msg: WsServerMessage) => void

// ---------------------------------------------------------------------------
// Общий WebSocket на всё приложение + реактивные ref'ы состояния.
// Экспортируем сами ref'ы (не shallowRef-обёртки), чтобы любой потребитель
// мог на них подписаться через watch/computed и получать актуальные значения.
// ---------------------------------------------------------------------------

let sharedSocket: WebSocket | null = null
let reconnectTimer: number | null = null
const handlers = new Set<Handler>()

const subscribedServiceId = ref<string | null>(null)
const isConnected = ref(false)
const reconnectAttempts = ref(0)
const peersCount = ref(0)

function resolveUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}

function open() {
  if (
    sharedSocket &&
    (sharedSocket.readyState === WebSocket.OPEN ||
     sharedSocket.readyState === WebSocket.CONNECTING)
  ) return

  const ws = new WebSocket(resolveUrl())
  sharedSocket = ws

  ws.addEventListener('open', () => {
    isConnected.value = true
    reconnectAttempts.value = 0
    if (subscribedServiceId.value) {
      send({ type: 'subscribe', serviceId: subscribedServiceId.value })
    }
  })

  ws.addEventListener('message', (ev) => {
    let msg: WsServerMessage | null = null
    try { msg = JSON.parse(ev.data as string) as WsServerMessage } catch { return }
    if (!msg) return
    if (msg.type === 'presence') peersCount.value = msg.count
    for (const h of handlers) {
      try { h(msg) } catch (e) { console.error('[ws] handler error', e) }
    }
  })

  ws.addEventListener('close', () => {
    isConnected.value = false
    scheduleReconnect()
  })

  ws.addEventListener('error', () => {
    isConnected.value = false
  })
}

function scheduleReconnect() {
  if (reconnectTimer != null) return
  const attempt = Math.min(reconnectAttempts.value + 1, 10)
  const delay = Math.min(1000 * 2 ** (attempt - 1), 15000)
  reconnectAttempts.value = attempt
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    open()
  }, delay)
}

function send(msg: WsClientMessage) {
  if (!sharedSocket || sharedSocket.readyState !== WebSocket.OPEN) return
  sharedSocket.send(JSON.stringify(msg))
}

export function useChecklistSocket() {
  if (import.meta.client && !sharedSocket) open()

  function subscribe(serviceId: string) {
    subscribedServiceId.value = serviceId
    send({ type: 'subscribe', serviceId })
  }

  function onMessage(handler: Handler) {
    handlers.add(handler)
    return () => handlers.delete(handler)
  }
  // Общий сокет живёт всё время жизни приложения — не закрываем его
  // при размонтировании компонента.

  return {
    // readonly, чтобы потребители случайно не перезаписывали
    isConnected: readonly(isConnected),
    peersCount: readonly(peersCount),
    subscribe,
    onMessage,
  }
}
