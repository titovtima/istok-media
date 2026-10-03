<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({ login: '', password: '' })
const msg = ref('')
const busy = ref(false)

async function submit() {
  msg.value = ''
  busy.value = true
  try {
    await auth.login({ login: form.login.trim(), password: form.password })
    await router.push('/')
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || 'Не удалось войти.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="wrap narrow">
    <div>
      <BrandBar />
      <h1>Вход</h1>
      <p class="subtitle">
        Войдите по логину или email, чтобы ваше имя автоматически
        подставлялось в чек-листе, календаре и обратной связи.
      </p>
    </div>

    <div class="card">
      <form @submit.prevent="submit">
        <div class="field">
          <label for="lg-id">Логин или email</label>
          <input id="lg-id" type="text" v-model="form.login" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="lg-pw">Пароль</label>
          <input id="lg-pw" type="password" v-model="form.password" autocomplete="current-password" required>
        </div>
        <div class="submit-row">
          <button type="submit" class="submit-btn" :disabled="busy">
            {{ busy ? 'вхожу…' : 'войти' }}
          </button>
          <NuxtLink to="/register" class="auth-link">зарегистрироваться</NuxtLink>
          <span class="form-msg error">{{ msg }}</span>
        </div>
      </form>
    </div>
  </div>
</template>
