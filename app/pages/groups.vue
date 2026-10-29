<script setup lang="ts">
useHead({ title: 'Группы служений' })

import { onMounted, reactive, ref } from 'vue'
import type { Group } from '~~/shared/types'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const groups = ref<Group[]>([])
const loading = ref(true)
const mounted = ref(false)
const err = ref('')

const showNewForm = ref(false)
const newForm = reactive({ id: '', label: '' })
const newMsg = ref('')
const newMsgKind = ref<'' | 'ok' | 'error'>('')
const newBusy = ref(false)

async function load() {
  loading.value = true
  err.value = ''
  try {
    groups.value = await $fetch<Group[]>('/api/groups')
  } catch (e: any) {
    err.value = e?.data?.statusMessage || 'Не удалось загрузить группы.'
  } finally {
    loading.value = false
  }
}
onMounted(() => { mounted.value = true; load() })

function isMember(g: Group): boolean {
  if (!auth.user) return false
  return g.members.some(m => m.userId === auth.user!.id)
}

async function join(g: Group) {
  try {
    await $fetch(`/api/groups/${g.id}/join`, { method: 'POST' })
    await load()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Не удалось вступить.')
  }
}

async function leave(g: Group) {
  if (!confirm(`Выйти из группы «${g.label}»?`)) return
  try {
    await $fetch(`/api/groups/${g.id}/leave`, { method: 'POST' })
    await load()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Не удалось выйти.')
  }
}

async function removeMember(g: Group, userId: string, fullName: string) {
  if (!auth.user?.isAdmin) return
  if (!confirm(`Удалить ${fullName} из группы «${g.label}»?`)) return
  try {
    await $fetch(`/api/groups/${g.id}/members/${userId}`, { method: 'DELETE' })
    await load()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Не удалось удалить.')
  }
}

async function createGroup() {
  newMsg.value = ''
  newMsgKind.value = ''
  newBusy.value = true
  try {
    const id = newForm.id.trim().toLowerCase()
    const label = newForm.label.trim()
    await $fetch('/api/groups', { method: 'POST', body: { id, label } })
    newForm.id = ''
    newForm.label = ''
    showNewForm.value = false
    await load()
  } catch (e: any) {
    newMsg.value = e?.data?.statusMessage || 'Не удалось создать группу.'
    newMsgKind.value = 'error'
  } finally {
    newBusy.value = false
  }
}

async function deleteGroup(g: Group) {
  if (!auth.user?.isAdmin) return
  if (!confirm(`Удалить группу «${g.label}»? Все участники будут исключены. Существующие брони от имени этой группы сохранятся.`)) return
  try {
    await $fetch(`/api/groups/${g.id}`, { method: 'DELETE' })
    await load()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Не удалось удалить группу.')
  }
}
</script>

<template>
  <div class="wrap">
    <div>
      <BrandBar />
      <h1>Группы служений</h1>
      <p class="subtitle">
        Вступить в группу можно свободно и в любой момент. Участники группы
        могут создавать, редактировать и удалять брони от имени своего служения.
        Администратор может управлять участниками и самими группами.
      </p>
    </div>

    <div class="card" v-if="mounted && auth.loaded && auth.user?.isAdmin">
      <div class="group-head">
        <h2>Управление</h2>
        <button type="button" class="submit-btn" @click="showNewForm = !showNewForm">
          {{ showNewForm ? 'отмена' : '+ создать группу' }}
        </button>
      </div>

      <div v-if="showNewForm" class="new-group-form">
        <div class="field">
          <label>id группы (латиница, для кода)</label>
          <input type="text" v-model="newForm.id" placeholder="напр. worship">
        </div>
        <div class="field">
          <label>Название</label>
          <input type="text" v-model="newForm.label" placeholder="напр. прославление">
        </div>
        <div class="submit-row">
          <button type="button" class="submit-btn" :disabled="newBusy" @click="createGroup">
            {{ newBusy ? 'создаю…' : 'создать' }}
          </button>
          <span class="form-msg" :class="newMsgKind">{{ newMsg }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="card"><div class="day-empty">Загрузка…</div></div>
    <div v-else-if="err" class="card"><div class="form-msg error">{{ err }}</div></div>

    <div v-else class="groups-list">
      <div v-for="g in groups" :key="g.id" class="card group-card">
        <div class="group-head">
          <h2>{{ g.label }}</h2>
          <div class="group-actions">
            <template v-if="mounted && auth.loaded && auth.isLoggedIn">
              <button
                v-if="isMember(g)"
                type="button"
                class="icon-btn"
                @click="leave(g)"
              >выйти из группы</button>
              <button
                v-else
                type="button"
                class="submit-btn small"
                @click="join(g)"
              >вступить</button>
            </template>
            <button
              v-if="mounted && auth.loaded && auth.user?.isAdmin"
              type="button"
              class="icon-btn"
              title="Удалить группу"
              @click="deleteGroup(g)"
            >✕ удалить группу</button>
          </div>
        </div>

        <div class="group-members">
          <div v-if="!g.members.length" class="day-empty">пока никого</div>
          <div v-for="m in g.members" :key="m.userId" class="group-member-row">
            <span class="group-member-name">{{ m.fullName }}</span>
            <span class="group-member-login">{{ m.login }}</span>
            <button
              v-if="mounted && auth.loaded && auth.user?.isAdmin"
              type="button"
              class="icon-btn"
              title="Удалить из группы"
              @click="removeMember(g, m.userId, m.fullName)"
            >✕</button>
          </div>
        </div>
      </div>
    </div>

    <footer>вступление в группу открыто для всех зарегистрированных</footer>
  </div>
</template>
