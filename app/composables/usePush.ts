import { ref } from 'vue'

// Статус — модульный, общий для всех вызовов usePush() в приложении.
const subscribed = ref(false)
const supported = ref(false)
const permission = ref<NotificationPermission>('default')

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function usePush() {
  async function refreshStatus() {
    if (!import.meta.client) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      supported.value = false
      return
    }
    supported.value = true
    permission.value = Notification.permission

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      subscribed.value = !!sub
    } catch {
      subscribed.value = false
    }
  }

  async function enable(): Promise<boolean> {
    if (!import.meta.client) return false
    if (!supported.value) return false

    const perm = await Notification.requestPermission()
    permission.value = perm
    if (perm !== 'granted') return false

    const { publicKey } = await $fetch<{ publicKey: string }>('/api/push/vapid-public-key')
    if (!publicKey) {
      alert('Push-уведомления не настроены на сервере (нет VAPID-ключей).')
      return false
    }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
    }

    const json = sub.toJSON() as any
    await $fetch('/api/push/subscribe', {
      method: 'POST',
      body: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
    })
    subscribed.value = true
    return true
  }

  async function disable(): Promise<void> {
    if (!import.meta.client) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await $fetch('/api/push/unsubscribe', {
        method: 'POST',
        body: { endpoint: sub.endpoint },
      }).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
    subscribed.value = false
  }

  return { subscribed, supported, permission, refreshStatus, enable, disable }
}
