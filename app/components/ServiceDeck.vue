<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DayKey, RecentService } from '~~/shared/types'
import { formatDateLabel, dayLabel, dayKeyForDate } from '~/composables/useFormat'

const props = defineProps<{
  date: string
  currentDay: DayKey
  slot: number
  dayServices: RecentService[]
  outfit: string
  recent: RecentService[]
  serviceId: string
  techDone: number
  techTotal: number
  wsConnected: boolean
  userName: string
}>()

const emit = defineEmits<{
  (e: 'change-date', v: string): void
  (e: 'change-outfit', v: string): void
  (e: 'select-slot', slot: number): void
  (e: 'add-service'): void
  (e: 'open-service', id: string): void
  (e: 'change-name', v: string): void
  (e: 'delete-service', id: string): void
}>()

function onDate(ev: Event) {
  emit('change-date', (ev.target as HTMLInputElement).value)
}
function onOutfit(ev: Event) {
  emit('change-outfit', (ev.target as HTMLInputElement).value)
}
function onName(ev: Event) {
  emit('change-name', (ev.target as HTMLInputElement).value)
}
function openByChip(id: string) {
  emit('open-service', id)
}
function requestDelete(r: RecentService) {
  const label = `${formatDateLabel(r.date)} · ${dayLabel(dayKeyForDate(r.date))}` +
    (r.slot > 1 ? ` · №${r.slot}` : '')
  if (!confirm(`Удалить собрание «${label}»? Все отметки будут потеряны.`)) return
  emit('delete-service', r.id)
}
function isActive(day: DayKey): boolean {
  return props.currentDay === day
}

const nameDraft = ref(props.userName)
watch(() => props.userName, (v) => { nameDraft.value = v })
function commitName() {
  if (nameDraft.value.trim() !== props.userName) {
    emit('change-name', nameDraft.value)
  }
}

function slotLabel(slot: number): string {
  return slot === 1 ? 'собрание 1' : `собрание ${slot}`
}
function chipLabel(r: RecentService): string {
  const base = `${formatDateLabel(r.date)} · ${dayLabel(dayKeyForDate(r.date))}`
  return r.slot > 1 ? `${base} · №${r.slot}` : base
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
      <div class="field slot-field">
        <label>Собрание</label>
        <div class="slot-toggle">
          <button
            v-for="s in dayServices"
            :key="s.id"
            type="button"
            class="slot-chip"
            :aria-pressed="s.slot === slot ? 'true' : 'false'"
            @click="emit('select-slot', s.slot)"
          >{{ slotLabel(s.slot) }}</button>
          <button
            type="button"
            class="slot-chip slot-add"
            @click="emit('add-service')"
            title="Добавить ещё одно собрание на эту дату"
          >+ ещё</button>
        </div>
      </div>
      <ProgressRing :done="techDone" :total="techTotal" />
    </div>

    <div class="deck-row">
      <div class="field wide">
        <label for="outfit">Цвет одежды прославления сегодня</label>
        <input
          id="outfit" type="text" :value="outfit"
          placeholder="напр. розовый, серый, белый"
          @change="onOutfit"
        >
      </div>
    </div>

    <div class="deck-row meta-row">
      <div class="field name-field">
        <label for="username">Кто проверяет</label>
        <input
          id="username"
          type="text"
          v-model="nameDraft"
          placeholder="имя (необязательно)"
          @blur="commitName"
          @keyup.enter="commitName"
        >
      </div>

      <span class="ws-status" :data-on="wsConnected ? 'true' : 'false'">
        <span class="ws-dot" />
        <template v-if="wsConnected">онлайн</template>
        <template v-else>нет соединения</template>
      </span>
    </div>

    <div v-if="recent.length" class="history">
      <span
        v-for="r in recent"
        :key="r.id"
        class="history-chip-wrap"
      >
        <button
          type="button"
          class="history-chip"
          :aria-current="r.id === serviceId ? 'true' : 'false'"
          @click="openByChip(r.id)"
        >{{ chipLabel(r) }}</button>
        <button
          type="button"
          class="history-chip-remove"
          title="Удалить собрание"
          aria-label="Удалить собрание"
          @click.stop="requestDelete(r)"
        >✕</button>
      </span>
    </div>
  </div>
</template>
