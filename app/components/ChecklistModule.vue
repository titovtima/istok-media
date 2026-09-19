<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CheckEntry, ModuleKey, TemplateItem } from '~~/shared/types'

const props = defineProps<{
  moduleKey: ModuleKey
  title: string
  items: TemplateItem[]
  checks: Record<string, CheckEntry>
  editing: boolean
  outfit: string
}>()

const emit = defineEmits<{
  (e: 'toggle-edit'): void
  (e: 'toggle-item', id: string, done: boolean): void
  (e: 'update-item', id: string, field: 'grp' | 'label', value: string): void
  (e: 'remove-item', id: string): void
  (e: 'add-item', grp: string, label: string): void
}>()

const newGroup = ref('')
const newLabel = ref('')

const grouped = computed(() => {
  const out: { grp: string; items: TemplateItem[] }[] = []
  for (const it of props.items) {
    const last = out[out.length - 1]
    if (last && last.grp === it.grp) last.items.push(it)
    else out.push({ grp: it.grp, items: [it] })
  }
  return out
})

const doneCount = computed(() =>
  props.items.reduce((n, t) => n + (props.checks[t.id]?.done ? 1 : 0), 0)
)

function submitAdd() {
  const g = newGroup.value.trim() || 'Без группы'
  const l = newLabel.value.trim()
  if (!l) return
  emit('add-item', g, l)
  newGroup.value = ''
  newLabel.value = ''
}
</script>

<template>
  <section class="module">
    <div class="module-head">
      <h2>{{ title }}</h2>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="count">{{ doneCount }}/{{ items.length }}</span>
        <button
          class="edit-toggle" type="button"
          :aria-pressed="editing ? 'true' : 'false'"
          @click="emit('toggle-edit')"
        >✎ пункты</button>
      </div>
    </div>

    <div class="items-slot">
      <template v-for="grp in grouped" :key="grp.grp">
        <div class="group-label">{{ grp.grp }}</div>
        <ChecklistItem
          v-for="it in grp.items"
          :key="it.id"
          :item="it"
          :entry="checks[it.id]"
          :editing="editing"
          :outfit="outfit"
          @toggle="(id, done) => emit('toggle-item', id, done)"
          @update="(id, field, value) => emit('update-item', id, field, value)"
          @remove="(id) => emit('remove-item', id)"
        />
      </template>
    </div>

    <div v-if="editing" class="add-row">
      <input v-model="newGroup" type="text" class="group-input" placeholder="Группа">
      <input v-model="newLabel" type="text" class="label-input" placeholder="Новый пункт…" @keyup.enter="submitAdd">
      <button type="button" @click="submitAdd">+ добавить</button>
    </div>
  </section>
</template>
