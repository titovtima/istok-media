<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({ fullName: '', login: '', email: '', password: '' })
const msg = ref('')
const busy = ref(false)

async function submit() {
  msg.value = ''
  busy.value = true
  try {
    await auth.register({
      fullName: form.fullName.trim(),
      login: form.login.trim().toLowerCase(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
    })
    await router.push('/')
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || 'Не удалось зарегистрироваться.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="wrap narrow">
    <div>
      <BrandBar />
      <h1>Регистрация</h1>
      <p class="subtitle">
        После регистрации ваше полное имя будет автоматически подставляться
        в чек-листе, календаре и обратной связи.
      </p>
    </div>

    <div class="card">
      <form @submit.prevent="submit">
        <div class="field">
          <label for="rg-name">Полное имя</label>
          <input id="rg-name" type="text" v-model="form.fullName" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="rg-login">Логин</label>
          <input id="rg-login" type="text" v-model="form.login" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="rg-email">Email</label>
          <input id="rg-email" type="email" v-model="form.email" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="rg-pw">Пароль</label>
          <input id="rg-pw" type="password" v-model="form.password" autocomplete="new-password" required>
        </div>
        <div class="submit-row">
          <button type="submit" class="submit-btn" :disabled="busy">
            {{ busy ? 'создаю…' : 'создать аккаунт' }}
          </button>
          <NuxtLink to="/login" class="auth-link">войти</NuxtLink>
          <span class="form-msg error">{{ msg }}</span>
        </div>
      </form>
    </div>
  </div>
</template>
