<script setup lang="ts">
useHead({ title: 'Настройки' })
import { reactive, ref, watch } from 'vue'
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

    <div class="card" v-if="auth.loaded && !auth.isLoggedIn">
      <p>Вы не авторизованы. <NuxtLink to="/login" class="auth-link">войти</NuxtLink></p>
    </div>
  </div>
</template>
