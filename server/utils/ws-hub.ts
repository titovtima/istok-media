// ---------------------------------------------------------------------------
// Реестр WebSocket-соединений Nitro/crossws.
//
// Защита от EPIPE:
//   • храним peer'ы в Map с метаданными;
//   • отправляем через setImmediate, вне HTTP-контекста;
//   • проверяем readyState, если crossws его отдаёт;
//   • send обёрнут в try/catch, при ошибке peer удаляется.
// ---------------------------------------------------------------------------

interface PeerLike {
  send: (data: string) => void
  readyState?: number
  websocket?: { readyState?: number }
}

interface PeerMeta {
  peer: PeerLike
  serviceId: string | null
}

interface HubGlobal {
  __mcWsHub?: Map<PeerLike, PeerMeta>
  __mcWsFlushScheduled?: boolean
  __mcWsQueue?: Array<() => void>
}
const g = globalThis as unknown as HubGlobal

function hub(): Map<PeerLike, PeerMeta> {
  if (!g.__mcWsHub) g.__mcWsHub = new Map()
  return g.__mcWsHub
}
function queue(): Array<() => void> {
  if (!g.__mcWsQueue) g.__mcWsQueue = []
  return g.__mcWsQueue
}

export function registerPeer(peer: PeerLike) {
  hub().set(peer, { peer, serviceId: null })
}
export function unregisterPeer(peer: PeerLike) {
  hub().delete(peer)
}
export function setPeerService(peer: PeerLike, serviceId: string) {
  const meta = hub().get(peer)
  if (!meta) return
  meta.serviceId = serviceId
}
export function getPeerService(peer: PeerLike): string | null {
  return hub().get(peer)?.serviceId ?? null
}

function isOpen(peer: PeerLike): boolean {
  const rs = peer.websocket?.readyState ?? peer.readyState
  if (typeof rs === 'number') return rs === 1
  return true
}

function safeSendNow(peer: PeerLike, text: string) {
  if (!isOpen(peer)) return
  try {
    peer.send(text)
  } catch {
    unregisterPeer(peer)
  }
}

function scheduleFlush() {
  if (g.__mcWsFlushScheduled) return
  g.__mcWsFlushScheduled = true
  const defer = typeof setImmediate === 'function'
    ? setImmediate
    : (fn: () => void) => Promise.resolve().then(fn)
  defer(() => {
    const q = queue()
    g.__mcWsFlushScheduled = false
    const jobs = q.splice(0, q.length)
    for (const job of jobs) {
      try { job() } catch { /* ничего не должно уронить процесс */ }
    }
  })
}

function enqueue(job: () => void) {
  queue().push(job)
  scheduleFlush()
}

export function broadcastToService(serviceId: string, payload: unknown) {
  const text = JSON.stringify(payload)
  for (const meta of hub().values()) {
    if (meta.serviceId !== serviceId) continue
    const peer = meta.peer
    enqueue(() => safeSendNow(peer, text))
  }
}

export function sendToPeer(peer: PeerLike, payload: unknown) {
  const text = JSON.stringify(payload)
  enqueue(() => safeSendNow(peer, text))
}

export function presenceFor(serviceId: string): number {
  let n = 0
  for (const meta of hub().values()) if (meta.serviceId === serviceId) n++
  return n
}

export function broadcastPresence(serviceId: string) {
  const count = presenceFor(serviceId)
  broadcastToService(serviceId, { type: 'presence', serviceId, count })
}
