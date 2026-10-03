<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AuthUser } from '~~/shared/types'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const users = ref<AuthUser[]>([])
const loading = ref(true)
const err = ref('')

async function load() {
  loading.value = true
  err.value = ''
  try {
    users.value = await $fetch<AuthUser[]>('/api/users')
  } catch (e: any) {
    err.value = e?.data?.statusMessage || 'Не удалось загрузить список.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function toggleAdmin(u: AuthUser) {
  if (!auth.user?.isAdmin) return
  if (u.id === auth.user.id && u.isAdmin) {
    if (!confirm('Снять с себя права администратора? Если это последний админ — операция не пройдёт.')) return
  }
  const next = !u.isAdmin
  u.isAdmin = next
  try {
    const updated = await $fetch<AuthUser>(`/api/users/${u.id}`, {
      method: 'PATCH',
      body: { isAdmin: next },
    })
    Object.assign(u, updated)
    if (auth.user?.id === u.id) auth.user.isAdmin = updated.isAdmin
  } catch (e: any) {
    u.isAdmin = !next
    alert(e?.data?.statusMessage || 'Не удалось изменить права.')
  }
}
</script>

<template>
  <div class="wrap">
    <div>
      <BrandBar />
      <h1>Пользователи</h1>
      <p class="subtitle">
        Список всех, кто зарегистрировался.
      </p>
    </div>

    <div class="card">
      <div v-if="loading" class="day-empty">Загрузка…</div>
      <div v-else-if="err" class="form-msg error">{{ err }}</div>
      <div v-else-if="!users.length" class="day-empty">Пока никого.</div>

      <div v-else class="user-list">
        <div v-for="u in users" :key="u.id" class="user-row">
          <div class="user-body">
            <div class="user-top">
              <span class="user-name">{{ u.fullName }}</span>
              <span v-if="u.isAdmin" class="user-tag">админ</span>
            </div>
            <div class="user-meta">
              <span>{{ u.login }}</span>
              <span class="muted"> · </span>
              <span class="muted">{{ u.email }}</span>
            </div>
          </div>
          <button
            v-if="auth.user?.isAdmin"
            type="button"
            class="icon-btn"
            :class="{ 'icon-restore': !u.isAdmin }"
            @click="toggleAdmin(u)"
          >{{ u.isAdmin ? 'снять админа' : 'сделать админом' }}</button>
        </div>
      </div>
    </div>

    <footer>назначать администраторов может только администратор</footer>
  </div>
</template>
