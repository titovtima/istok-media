<script setup lang="ts">
import type { DayKey, RecentService } from '~~/shared/types'
import { formatDateLabel, dayLabel } from '~/composables/useFormat'

const props = defineProps<{
  date: string
  currentDay: DayKey
  outfit: string
  recent: RecentService[]
  serviceId: string
  techDone: number
  techTotal: number
  wsConnected: boolean
  wsPeers: number
}>()

const emit = defineEmits<{
  (e: 'change-date', v: string): void
  (e: 'change-outfit', v: string): void
  (e: 'open-service', id: string): void
}>()

function onDate(ev: Event) {
  emit('change-date', (ev.target as HTMLInputElement).value)
}
function onOutfit(ev: Event) {
  emit('change-outfit', (ev.target as HTMLInputElement).value)
}
function openByChip(id: string) {
  emit('open-service', id)
}
function isActive(day: DayKey): boolean {
  return props.currentDay === day
}
</script>

<template>
  <div class="deck">
    <div class="deck-row">
      <div class="field">
        <label for="svc-date">Дата служения</label>
        <input id="svc-date" type="date" :value="date" @change="onDate">
      </div>
      <div class="field day-field">
        <label>День недели</label>
        <div class="day-toggle" role="status" aria-live="polite">
          <span class="day-badge" :aria-pressed="isActive('wednesday') ? 'true' : 'false'">Среда</span>
          <span class="day-badge" :aria-pressed="isActive('sunday') ? 'true' : 'false'">Воскресенье</span>
        </div>
      </div>
      <div class="field wide">
        <label for="outfit">Цвет одежды прославления сегодня</label>
        <input
          id="outfit" type="text" :value="outfit"
          placeholder="напр. розовый, серый, белый"
          @change="onOutfit"
        >
      </div>
      <ProgressRing :done="techDone" :total="techTotal" />
    </div>

    <div class="deck-row ws-row">
      <span class="ws-status" :data-on="wsConnected ? 'true' : 'false'">
        <span class="ws-dot" />
        <template v-if="wsConnected">
          онлайн: {{ wsPeers }} {{ wsPeers === 1 ? 'участник' : 'участников' }}
        </template>
        <template v-else>нет соединения, переподключаемся…</template>
      </span>
    </div>

    <div v-if="recent.length" class="history">
      <button
        v-for="r in recent"
        :key="r.id"
        type="button"
        class="history-chip"
        :aria-current="r.id === serviceId ? 'true' : 'false'"
        @click="openByChip(r.id)"
      >
        {{ formatDateLabel(r.date) }} · {{ dayLabel(r.day) }}
      </button>
    </div>
  </div>
</template>
