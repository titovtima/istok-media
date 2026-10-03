<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useActor } from '~/composables/useActor'
import type { FeedbackEntry, FeedbackService, WsServerMessage } from '~~/shared/types'

const NAME_KEY = 'mc_name'

const SERVICE_LABEL: Record<FeedbackService, string> = {
  vosslavlenie: 'прославление',
  poryadok: 'служба порядка',
  uborka: 'уборка залов и помещений',
  media: 'медиаслужение',
  other: 'другое',
}

const SERVICE_OPTIONS: FeedbackService[] = ['vosslavlenie','poryadok','uborka','media','other']

const FILTERS = [
  { key: 'all', label: 'все' },
  { key: 'vosslavlenie', label: 'прославление' },
  { key: 'poryadok', label: 'служба порядка' },
  { key: 'uborka', label: 'уборка' },
  { key: 'media', label: 'медиа' },
  { key: 'other', label: 'другое' },
  { key: 'unresolved', label: 'необработанные' },
] as const

type FilterKey = typeof FILTERS[number]['key']

const entries = ref<FeedbackEntry[]>([])
const loading = ref(true)
const filter = ref<FilterKey>('all')

const form = reactive({
  name: '',
  service: null as FeedbackService | null,
  otherNote: '',
  description: '',
})
const formMsg = ref('')
const formMsgKind = ref<'' | 'ok' | 'error'>('')

const localName = ref('')
const { actor, displayName: accountViewerName } = useActor()
onMounted(() => {
  try { localName.value = localStorage.getItem(NAME_KEY) || '' } catch {}
  if (accountViewerName.value) form.name = accountViewerName.value
  else if (accountViewerName.value) form.name = accountViewerName.value
  else if (localName.value) form.name = localName.value
})

// ---------- WS ----------
const socket = useChecklistSocket()
socket.subscribe('feedback')

function handleMessage(msg: WsServerMessage) {
  if (msg.type === 'feedback-created') {
    if (!entries.value.some(e => e.id === msg.entry.id)) {
      entries.value.unshift(msg.entry)
    }
    return
  }
  if (msg.type === 'feedback-updated') {
    const e = entries.value.find(x => x.id === msg.id)
    if (e) {
      e.resolved = msg.resolved
      e.resolvedBy = msg.resolvedBy
      e.resolvedAt = msg.resolvedAt
    }
    return
  }
}
let unsubscribe: (() => void) | null = null

onMounted(async () => {
  try {
    entries.value = await $fetch<FeedbackEntry[]>('/api/feedback')
  } finally {
    loading.value = false
  }
  unsubscribe = socket.onMessage(handleMessage)
})

// ---------- сохранение имени ----------
function persistName() {
  accountViewerName.value = form.name.trim()
  accountViewerName.value = form.name.trim()
  const n = form.name.trim()
  if (!n) return
  if (n !== localName.value) {
    localName.value = n
    try { localStorage.setItem(NAME_KEY, n) } catch {}
  }
}

// ---------- отправка ----------
async function submit() {
  formMsg.value = ''
  formMsgKind.value = ''
  if (!form.name.trim()) { formMsg.value = 'Укажите ФИО.'; formMsgKind.value = 'error'; return }
  if (!form.service) { formMsg.value = 'Выберите служение.'; formMsgKind.value = 'error'; return }
  if (form.service === 'other' && !form.otherNote.trim()) {
    formMsg.value = 'Уточните, что именно.'; formMsgKind.value = 'error'; return
  }
  if (!form.description.trim()) { formMsg.value = 'Опишите, что случилось.'; formMsgKind.value = 'error'; return }

  persistName()

  try {
    const created = await $fetch<FeedbackEntry>('/api/feedback', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        service: form.service,
        actor: actor.value,
        otherNote: form.service === 'other' ? form.otherNote.trim() : '',
        description: form.description.trim(),
        actor: actor.value,
      },
    })
    // Дедупликация: WS-эхо может прийти раньше ответа PUT, поэтому
    // проверяем, что запись с таким id ещё не добавлена.
    if (!entries.value.some(e => e.id === created.id)) {
      entries.value.unshift(created)
    }
    formMsg.value = 'Спасибо, обращение принято.'
    formMsgKind.value = 'ok'
    form.description = ''
    form.service = null
    form.otherNote = ''
  } catch (e: any) {
    formMsg.value = e?.data?.statusMessage || 'Не удалось отправить, попробуйте ещё раз.'
    formMsgKind.value = 'error'
  }
}

// ---------- фильтр ----------
const visible = computed(() => {
  if (filter.value === 'all') return entries.value
  if (filter.value === 'unresolved') return entries.value.filter(e => !e.resolved)
  return entries.value.filter(e => e.service === filter.value)
})
const activeCount = computed(() => entries.value.filter(e => !e.resolved).length)

// ---------- переключение «обработано» ----------
async function toggleResolved(entry: FeedbackEntry, resolved: boolean) {
  let by: string | null = null
  let at: string | null = null
  if (resolved) {
    by = localName.value || promptName()
    at = nowShort()
  }
  // оптимистично
  const prev = { resolved: entry.resolved, by: entry.resolvedBy, at: entry.resolvedAt }
  entry.resolved = resolved
  entry.resolvedBy = by
  entry.resolvedAt = at

  try {
    await $fetch(`/api/feedback/${entry.id}`, {
      method: 'PATCH',
      body: { resolved, resolvedBy: by, resolvedAt: at },
    })
  } catch {
    // откат при ошибке
    entry.resolved = prev.resolved
    entry.resolvedBy = prev.by
    entry.resolvedAt = prev.at
  }
}

function promptName(): string {
  const n = (window.prompt('Ваше имя (чтобы было видно, кто обработал обращение):', '') || '').trim()
  if (n) {
    localName.value = n
    form.name = form.name || n
    try { localStorage.setItem(NAME_KEY, n) } catch {}
  }
  return n
}

function nowShort(): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function tagText(e: FeedbackEntry): string {
  const base = SERVICE_LABEL[e.service] || e.service
  return e.otherNote ? `${base} — ${e.otherNote}` : base
}
</script>

<template>
  <div class="wrap">
    <div>
      <BrandBar />
      <h1>Обратная связь</h1>
      <p class="subtitle">
        Если что-то пошло не так на служении — по прославлению, порядку,
        уборке или медиа — напишите здесь. Журнал общий для всей команды
        и обновляется в реальном времени.
      </p>
    </div>

    <div class="card">
      <form @submit.prevent="submit">
        <div class="field">
          <label for="fb-name">ФИО</label>
          <input
            id="fb-name"
            v-model="form.name"
            type="text"
            placeholder="Фамилия Имя Отчество"
            autocomplete="name"
            @blur="persistName"
          >
        </div>

        <div class="field">
          <label>Служение</label>
          <div class="pill-group">
            <button
              v-for="s in SERVICE_OPTIONS"
              :key="s"
              type="button"
              :aria-pressed="form.service === s ? 'true' : 'false'"
              @click="form.service = s"
            >{{ SERVICE_LABEL[s] }}</button>
          </div>
        </div>

        <div class="field" v-if="form.service === 'other'">
          <label for="fb-other">Уточните, что именно</label>
          <input
            id="fb-other"
            v-model="form.otherNote"
            type="text"
            placeholder="например: звонница, детское служение…"
          >
        </div>

        <div class="field">
          <label for="fb-desc">Что случилось</label>
          <textarea
            id="fb-desc"
            v-model="form.description"
            placeholder="Опишите проблему как можно конкретнее: что произошло, когда, где"
          ></textarea>
        </div>

        <div class="submit-row">
          <button type="submit" class="submit-btn">отправить</button>
          <span class="form-msg" :class="formMsgKind">{{ formMsg }}</span>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="log-head">
        <h2>Журнал обращений</h2>
        <span class="log-count">{{ activeCount }} активных</span>
      </div>

      <div class="log-filters">
        <div class="pill-group">
          <button
            v-for="f in FILTERS"
            :key="f.key"
            type="button"
            :aria-pressed="filter === f.key ? 'true' : 'false'"
            @click="filter = f.key"
          >{{ f.label }}</button>
        </div>
      </div>

      <div class="log-list">
        <div v-if="loading" class="log-empty">Загрузка…</div>
        <div v-else-if="!visible.length" class="log-empty">Пока пусто.</div>
        <div
          v-for="entry in visible"
          :key="entry.id"
          class="log-entry"
          :class="{ resolved: entry.resolved }"
        >
          <input
            type="checkbox"
            class="log-check"
            :checked="entry.resolved"
            @change="(ev) => toggleResolved(entry, (ev.target as HTMLInputElement).checked)"
          >
          <div class="log-body">
            <div class="log-top">
              <span class="log-tag">{{ tagText(entry) }}</span>
              <span class="log-name">{{ entry.authorName }}</span>
              <span class="log-time">{{ entry.createdLabel }}</span>
            </div>
            <div class="log-desc">{{ entry.description }}</div>
            <div v-if="entry.resolved && entry.resolvedBy" class="log-resolved-meta">
              ✓ обработал(а) {{ entry.resolvedBy }}<template v-if="entry.resolvedAt"> · {{ entry.resolvedAt }}</template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="ws-status" :data-on="socket.isConnected.value ? 'true' : 'false'">
      <span class="ws-dot" />
      <template v-if="socket.isConnected.value">онлайн</template>
      <template v-else>нет соединения</template>
    </div>

    <footer>журнал общий для команды — синхронизируется между всеми устройствами</footer>
  </div>
</template>
