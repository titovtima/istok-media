<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ done: number; total: number }>()

const R = 21
const C = computed(() => 2 * Math.PI * R)
const pct = computed(() => (props.total ? props.done / props.total : 0))
const offset = computed(() => C.value * (1 - pct.value))
const label = computed(() => Math.round(pct.value * 100) + '%')
</script>

<template>
  <div class="progress-summary">
    <div class="ring">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle class="track" cx="26" cy="26" :r="R" />
        <circle class="fill" cx="26" cy="26" :r="R"
                :stroke-dasharray="C" :stroke-dashoffset="offset" />
      </svg>
      <div class="num">{{ label }}</div>
    </div>
    <div class="progress-label">
      Готово всего<br>
      <b>{{ done }} / {{ total }}</b>
    </div>
  </div>
</template>
