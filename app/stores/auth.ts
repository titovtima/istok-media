import { defineStore } from 'pinia'
import type { AuthUser } from '~~/shared/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    loaded: false,
  }),
  getters: {
    isLoggedIn: (s) => !!s.user,
    // Имя, которое должно подставляться в чек-лист/календарь/обратную связь.
    // Если пользователь вошёл — из аккаунта. Иначе — пусто (фронт сам
    // возьмёт mc_name из localStorage).
    accountName: (s) => s.user?.fullName || '',
  },
  actions: {
    async fetchMe() {
      try {
        this.user = await $fetch<AuthUser | null>('/api/auth/me')
      } catch {
        this.user = null
      } finally {
        this.loaded = true
      }
    },
    async register(payload: { fullName: string; login: string; email: string; password: string }) {
      this.user = await $fetch<AuthUser>('/api/auth/register', {
        method: 'POST',
        body: payload,
      })
    },
    async login(payload: { login: string; password: string }) {
      this.user = await $fetch<AuthUser>('/api/auth/login', {
        method: 'POST',
        body: payload,
      })
    },
    async logout() {
      try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch {}
      this.user = null
    },
  },
})
