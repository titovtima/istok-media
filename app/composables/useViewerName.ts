import { computed, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

const NAME_KEY = 'mc_name'

// Глобальный override имени на текущую сессию вкладки.
// Сбрасывается при перезагрузке страницы — это by design:
// «при новом заходе пусть изменённое сбрасывается и используется
//  снова имя из аккаунта».
const override = ref<string | null>(null)

export function useViewerName() {
  const auth = useAuthStore()

  // Если пользователь вошёл, и override пуст — берём имя из аккаунта.
  // Если не вошёл — из localStorage (как было раньше).
  const fromStorage = ref('')
  if (import.meta.client && !auth.isLoggedIn) {
    try { fromStorage.value = localStorage.getItem(NAME_KEY) || '' } catch {}
  }

  const viewerName = computed<string>({
    get() {
      if (auth.isLoggedIn) {
        return override.value ?? auth.accountName
      }
      return fromStorage.value
    },
    set(v: string) {
      const n = v.trim()
      if (auth.isLoggedIn) {
        // override — только на текущую сессию вкладки; в localStorage не пишем.
        override.value = n || auth.accountName
      } else {
        fromStorage.value = n
        try {
          if (n) localStorage.setItem(NAME_KEY, n)
          else localStorage.removeItem(NAME_KEY)
        } catch {}
      }
    },
  })

  // Реактивно: если пользователь залогинился/разлогинился — сбрасываем override.
  watch(() => auth.isLoggedIn, () => {
    override.value = null
    if (import.meta.client && !auth.isLoggedIn) {
      try { fromStorage.value = localStorage.getItem(NAME_KEY) || '' } catch {}
    }
  })

  return { viewerName }
}

export function resetViewerNameOverride() {
  override.value = null
}
