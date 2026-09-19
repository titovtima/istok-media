<script setup lang="ts">
import type { CheckEntry, TemplateItem } from '~~/shared/types'
import { labelWithOutfit } from '~/composables/useFormat'

const props = defineProps<{
  item: TemplateItem
  entry?: CheckEntry
  editing: boolean
  outfit: string
}>()

const emit = defineEmits<{
  (e: 'toggle', id: string, done: boolean): void
  (e: 'update', id: string, field: 'grp' | 'label', value: string): void
  (e: 'remove', id: string): void
}>()

function onToggle(ev: Event) {
  emit('toggle', props.item.id, (ev.target as HTMLInputElement).checked)
}
function onBlurGroup(ev: Event) {
  emit('update', props.item.id, 'grp', (ev.target as HTMLInputElement).value)
}
function onBlurLabel(ev: Event) {
  emit('update', props.item.id, 'label', (ev.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="item" :class="{ done: entry?.done }" :data-id="item.id">
    <template v-if="!editing">
      <input
        :id="`chk-${item.module}-${item.id}`"
        type="checkbox"
        :checked="!!entry?.done"
        @change="onToggle"
      >
      <div class="item-body">
        <label class="item-label" :for="`chk-${item.module}-${item.id}`">
          {{ labelWithOutfit(item.label, outfit) }}
        </label>
        <div v-if="entry?.done && entry.by" class="item-meta">
          ✓ {{ entry.by }}<template v-if="entry.at"> · {{ entry.at }}</template>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="item-body">
        <div class="item-edit-row">
          <input
            type="text" class="group-input"
            :value="item.grp" style="width:120px"
            @blur="onBlurGroup"
          >
          <input
            type="text" class="label-input"
            :value="item.label"
            @blur="onBlurLabel"
          >
          <button type="button" class="icon-btn" title="Удалить пункт"
                  @click="emit('remove', item.id)">✕</button>
        </div>
      </div>
    </template>
  </div>
</template>
