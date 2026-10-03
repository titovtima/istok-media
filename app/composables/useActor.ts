import { computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

// override имени — только на сессию вкладки. Сбрасывается при перезагрузке.
const override = ref<string | null>(null)

export function useActor() {
  const auth = useAuthStore()

  // displayName: то, что в поле «Кто...».
  //   • залогинен + override пуст → full_name из аккаунта
  //   • залогинен + override есть → override
  //   • не залогинен → localStorage mc_name
  const displayName = computed<string>({
    get() {
      if (auth.isLoggedIn) return override.value ?? (auth.user?.fullName || '')
      if (import.meta.client) {
        try { return localStorage.getItem('mc_name') || '' } catch {}
      }
      return ''
    },
    set(v: string) {
      const n = v.trim()
      if (auth.isLoggedIn) {
        override.value = n || (auth.user?.fullName || '')
      } else if (import.meta.client) {
        try {
          if (n) localStorage.setItem('mc_name', n)
          else localStorage.removeItem('mc_name')
        } catch {}
      }
    },
  })

  // actor:
  //   • залогинен и displayName совпадает с full_name → login
  //   • залогинен, но override другое имя → anon:<override>
  //   • не залогинен → anon:<displayName>
  const actor = computed<string>(() => {
    const dn = displayName.value.trim()
    if (auth.isLoggedIn && auth.user) {
      if (!dn || dn === auth.user.fullName) return auth.user.login
      return 'anon:' + dn
    }
    return 'anon:' + (dn || 'unknown')
  })

  function resetOverride() {
    override.value = null
  }

  return { actor, displayName, resetOverride }
}

export function resetActorOverride() {
  override.value = null
}
