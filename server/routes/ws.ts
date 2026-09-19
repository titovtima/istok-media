import {
  registerPeer,
  unregisterPeer,
  setPeerService,
  getPeerService,
  sendToPeer,
  broadcastPresence,
} from '~~/server/utils/ws-hub'
import type { WsClientMessage, WsHello } from '~~/shared/types'

export default defineWebSocketHandler({
  open(peer) {
    registerPeer(peer as any)
    const hello: WsHello = {
      type: 'hello',
      clientId: Math.random().toString(36).slice(2, 10),
    }
    sendToPeer(peer as any, hello)
  },

  message(peer, message) {
    let data: WsClientMessage | null = null
    try {
      data = JSON.parse(message.text()) as WsClientMessage
    } catch {
      sendToPeer(peer as any, { type: 'error', message: 'invalid json' })
      return
    }
    if (data?.type === 'subscribe' && typeof data.serviceId === 'string') {
      const prev = getPeerService(peer as any)
      setPeerService(peer as any, data.serviceId)
      if (prev && prev !== data.serviceId) broadcastPresence(prev)
      broadcastPresence(data.serviceId)
    }
  },

  close(peer) {
    const room = getPeerService(peer as any)
    unregisterPeer(peer as any)
    if (room) broadcastPresence(room)
  },

  error(peer) {
    const room = getPeerService(peer as any)
    unregisterPeer(peer as any)
    if (room) broadcastPresence(room)
  },
})
