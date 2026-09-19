<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChecklistStore } from '~/stores/checklist'
import type { ModuleKey } from '~~/shared/types'

const store = useChecklistStore()
const {
  templates, editMode, serviceId, date, outfit, checks, recent,
  techDone, techTotal, currentDayKey, wsConnected, wsPeers,
} = storeToRefs(store)

onMounted(() => {
  store.bootstrap()
})

async function changeDate(v: string) {
  if (!v) return
  await store.loadService(v)
}
async function changeOutfit(v: string) {
  store.outfit = v
  await store.saveServiceMeta()
}
async function openService(id: string) {
  const d = id.split('_')[0]
  await store.loadService(d)
}
function toggleEdit(key: ModuleKey) {
  store.editMode[key] = !store.editMode[key]
}
async function toggleItem(id: string, done: boolean) {
  await store.toggle(id, done)
}
async function updateItem(key: ModuleKey, id: string, field: 'grp' | 'label', value: string) {
  const trimmed = value.trim()
  if (!trimmed && field === 'label') return
  await store.updateTemplate(id, field === 'grp' ? { grp: trimmed } : { label: trimmed }, key)
}
async function removeItem(key: ModuleKey, id: string) {
  await store.removeTemplate(id, key)
}
async function addItem(key: ModuleKey, grp: string, label: string) {
  await store.addTemplate(key, grp, label)
}
</script>

<template>
  <div class="wrap">
    <div>
      <BrandBar />
      <h1>Пульт медиаслужения</h1>
      <p class="subtitle">
        Чек-лист технической готовности перед собранием. Отметки сохраняются
        в общей базе данных и синхронизируются между устройствами медиа-команды
        в реальном времени.
      </p>
    </div>

    <ServiceDeck
      :date="date"
      :current-day="currentDayKey"
      :outfit="outfit"
      :recent="recent"
      :service-id="serviceId"
      :tech-done="techDone"
      :tech-total="techTotal"
      :ws-connected="wsConnected"
      :ws-peers="wsPeers"
      @change-date="changeDate"
      @change-outfit="changeOutfit"
      @open-service="openService"
    />

    <div class="modules">
      <ChecklistModule
        module-key="tech"
        title="Техническая готовность"
        :items="templates.tech"
        :checks="checks"
        :editing="editMode.tech"
        :outfit="outfit"
        @toggle-edit="toggleEdit('tech')"
        @toggle-item="toggleItem"
        @update-item="(id, f, v) => updateItem('tech', id, f, v)"
        @remove-item="(id) => removeItem('tech', id)"
        @add-item="(g, l) => addItem('tech', g, l)"
      />
    </div>

    <footer>отметки синхронизируются между всеми устройствами медиа-команды через общую базу</footer>
  </div>
</template>
