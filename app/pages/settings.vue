<script setup lang="ts">
useHead({ title: 'Настройки' })
import { onMounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const router = useRouter()

// Если не залогинен — отправляем на /login
onMounted(() => {
  if (auth.loaded && !auth.isLoggedIn) {
    router.replace('/login')
  }
})
watch(() => auth.loaded, (v) => {
  if (v && !auth.isLoggedIn) router.replace('/login')
})

// --------- Профиль ---------
const profile = reactive({
  fullName: auth.user?.fullName || '',
  email: auth.user?.email || '',
})
watch(() => auth.user, (u) => {
  if (u) {
    profile.fullName = u.fullName
    profile.email = u.email
  }
}, { immediate: true })

const profileMsg = ref('')
const profileMsgKind = ref<'' | 'ok' | 'error'>('')
const profileBusy = ref(false)

async function saveProfile() {
  profileMsg.value = ''
  profileMsgKind.value = ''
  profileBusy.value = true
  try {
    const updated = await $fetch<{ id: string; email: string; login: string; fullName: string }>(
      '/api/auth/profile',
      {
        method: 'PATCH',
        body: {
          fullName: profile.fullName.trim(),
          email: profile.email.trim().toLowerCase(),
        },
      }
    )
    auth.user = updated
    profileMsg.value = 'Сохранено.'
    profileMsgKind.value = 'ok'
  } catch (e: any) {
    profileMsg.value = e?.data?.statusMessage || 'Не удалось сохранить.'
    profileMsgKind.value = 'error'
  } finally {
    profileBusy.value = false
  }
}

// --------- Пароль ---------
const pw = reactive({ current: '', next: '', confirm: '' })
const pwMsg = ref('')
const pwMsgKind = ref<'' | 'ok' | 'error'>('')
const pwBusy = ref(false)

// --------- Сессии ---------
interface SessionItem {
  id: string
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}
const sessions = ref<SessionItem[]>([])
const sessionsLoading = ref(false)
const sessionsErr = ref('')

async function loadSessions() {
  sessionsLoading.value = true
  sessionsErr.value = ''
  try {
    sessions.value = await $fetch<SessionItem[]>('/api/auth/sessions')
  } catch (e: any) {
    sessionsErr.value = e?.data?.statusMessage || 'Не удалось загрузить список сессий.'
  } finally {
    sessionsLoading.value = false
  }
}

async function revokeSession(sess: SessionItem) {
  if (sess.current) return
  if (!confirm('Выйти из этой сессии? Устройство потребует повторного входа.')) return
  try {
    await $fetch(`/api/auth/sessions/${encodeURIComponent(sess.id)}`, { method: 'DELETE' })
    sessions.value = sessions.value.filter(s => s.id !== sess.id)
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Не удалось завершить сессию.')
  }
}

async function revokeAll() {
  if (!confirm('Выйти со всех устройств, кроме этого? На них потребуется повторный вход.')) return
  try {
    await $fetch('/api/auth/sessions/revoke-all', { method: 'POST' })
    await loadSessions()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Не удалось завершить сессии.')
  }
}

// Определение браузера/ОС из user-agent — грубо, но для отображения хватает.
function describeAgent(ua: string | null): string {
  if (!ua) return 'Неизвестное устройство'
  const u = ua.toLowerCase()
  let browser = 'Браузер'
  if (u.includes('firefox')) browser = 'Firefox'
  else if (u.includes('edg/')) browser = 'Edge'
  else if (u.includes('chrome') && !u.includes('chromium')) browser = 'Chrome'
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari'
  else if (u.includes('opr/') || u.includes('opera')) browser = 'Opera'

  let os = ''
  if (u.includes('windows')) os = 'Windows'
  else if (u.includes('mac os') || u.includes('macintosh')) os = 'macOS'
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS'
  else if (u.includes('android')) os = 'Android'
  else if (u.includes('linux')) os = 'Linux'

  return os ? `${browser} · ${os}` : browser
}

function fmt(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(loadSessions)

async function savePassword() {
  pwMsg.value = ''
  pwMsgKind.value = ''
  if (pw.next.length < 6) {
    pwMsg.value = 'Новый пароль не короче 6 символов.'
    pwMsgKind.value = 'error'
    return
  }
  if (pw.next !== pw.confirm) {
    pwMsg.value = 'Пароли не совпадают.'
    pwMsgKind.value = 'error'
    return
  }
  pwBusy.value = true
  try {
    await $fetch('/api/auth/password', {
      method: 'PATCH',
      body: { currentPassword: pw.current, newPassword: pw.next },
    })
    pw.current = ''
    pw.next = ''
    pw.confirm = ''
    pwMsg.value = 'Пароль обновлён.'
    pwMsgKind.value = 'ok'
  } catch (e: any) {
    pwMsg.value = e?.data?.statusMessage || 'Не удалось обновить пароль.'
    pwMsgKind.value = 'error'
  } finally {
    pwBusy.value = false
  }
}
</script>

<template>
  <div class="wrap narrow">
    <div>
      <BrandBar />
      <h1>Настройки</h1>
      <p class="subtitle">
        Профиль и пароль.
      </p>
    </div>

    <div class="card" v-if="auth.isLoggedIn">
      <h2>Профиль</h2>
      <div class="field">
        <label>Логин</label>
        <div class="readonly-value">{{ auth.user?.login }}</div>
        <div class="hint">Логин изменить нельзя.</div>
      </div>

      <div class="field">
        <label for="st-name">Полное имя</label>
        <input id="st-name" type="text" v-model="profile.fullName" autocomplete="name">
      </div>

      <div class="field">
        <label for="st-email">Email</label>
        <input id="st-email" type="email" v-model="profile.email" autocomplete="email">
        <div class="hint">Пока просто контакт; подтверждение и сброс пароля — позже.</div>
      </div>

      <div class="submit-row">
        <button type="button" class="submit-btn" :disabled="profileBusy" @click="saveProfile">
          {{ profileBusy ? 'сохраняю…' : 'сохранить' }}
        </button>
        <span class="form-msg" :class="profileMsgKind">{{ profileMsg }}</span>
      </div>
    </div>

    <div class="card" v-if="auth.isLoggedIn">
      <h2>Смена пароля</h2>
      <div class="field">
        <label for="st-cur">Текущий пароль</label>
        <input id="st-cur" type="password" v-model="pw.current" autocomplete="current-password">
      </div>
      <div class="field">
        <label for="st-new">Новый пароль</label>
        <input id="st-new" type="password" v-model="pw.next" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="st-conf">Повторите новый пароль</label>
        <input id="st-conf" type="password" v-model="pw.confirm" autocomplete="new-password">
      </div>
      <div class="submit-row">
        <button type="button" class="submit-btn" :disabled="pwBusy" @click="savePassword">
          {{ pwBusy ? 'меняю…' : 'сменить пароль' }}
        </button>
        <span class="form-msg" :class="pwMsgKind">{{ pwMsg }}</span>
      </div>
    </div>

    
    <div class="card" v-if="auth.isLoggedIn">
      <h2>Активные сессии</h2>
      <p class="hint" style="margin:0 0 12px;">
        Устройства, где вы вошли под своим аккаунтом. Сессии автоматически
        продлеваются при активности и живут 30 дней с последнего использования.
      </p>

      <div v-if="sessionsLoading" class="day-empty">Загрузка…</div>
      <div v-else-if="sessionsErr" class="form-msg error">{{ sessionsErr }}</div>
      <div v-else-if="!sessions.length" class="day-empty">Нет активных сессий.</div>

      <div v-else class="session-list">
        <div v-for="sess in sessions" :key="sess.id" class="session-row">
          <div class="session-body">
            <div class="session-top">
              <span class="session-device">{{ describeAgent(sess.userAgent) }}</span>
              <span v-if="sess.current" class="session-tag">эта сессия</span>
            </div>
            <div class="session-meta">
              <span v-if="sess.ip">{{ sess.ip }} · </span>
              создана {{ fmt(sess.createdAt) }} · активна {{ fmt(sess.lastSeenAt) }}
            </div>
          </div>
          <button
            v-if="!sess.current"
            type="button"
            class="icon-btn"
            title="Выйти из этой сессии"
            @click="revokeSession(sess)"
          >✕ выйти</button>
        </div>
      </div>

      <div class="submit-row" v-if="sessions.length > 1">
        <button type="button" class="submit-btn warn-btn" @click="revokeAll">
          выйти со всех устройств, кроме этого
        </button>
      </div>
    </div>

    <div class="card" v-if="auth.loaded && !auth.isLoggedIn">
      <p>Вы не авторизованы. <NuxtLink to="/login" class="auth-link">войти</NuxtLink></p>
    </div>
  </div>
</template>
