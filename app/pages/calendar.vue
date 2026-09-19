<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type {
  AttendanceStatus, BookingResource, BookingWithAttendance,
  OrganizerType, WsServerMessage,
} from '~~/shared/types'

const NAME_KEY = 'mc_name'
const CHURCH_NAME = 'Источник Жизни'

const RESOURCE_LABEL: Record<BookingResource, string> = {
  small: 'малый зал',
  big: 'большой зал',
  studio: 'студия',
}
const ORGANIZER_LABEL: Record<OrganizerType, string> = {
  person: 'человек',
  ministry: 'служение',
  church: 'церковь',
}
const MINISTRIES = [
  { id: 'worship', label: 'прославление' },
  { id: 'media', label: 'медиаслужение' },
  { id: 'order', label: 'служба порядка' },
  { id: 'cleaning', label: 'уборка' },
  { id: 'kids', label: 'детское служение' },
  { id: 'youth', label: 'молодёжное служение' },
  { id: 'prayer', label: 'молитвенное служение' },
]
const WEEKDAYS_RU = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота']

const clientId = ref('')
const viewerName = ref('')
onMounted(() => {
  clientId.value = useClientId()
  try { viewerName.value = localStorage.getItem(NAME_KEY) || '' } catch {}
})

// ---------------- Понедельник как начало недели ----------------
// Возвращает понедельник той недели, в которой находится дата `d`.
function mondayOf(d: Date): string {
  const x = new Date(d)
  const dow = x.getDay() // 0=вс, 1=пн, ...
  const diff = (dow === 0 ? -6 : 1 - dow) // сдвиг к понедельнику
  x.setDate(x.getDate() + diff)
  return isoDate(x)
}
function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`
}
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dd = new Date(y, m-1, d); dd.setDate(dd.getDate()+n)
  return isoDate(dd)
}

// ---------------- Форма ----------------
const form = reactive({
  mode: 'single' as 'single' | 'weekly' | 'biweekly',
  date: isoDate(new Date()),
  start: '10:00',
  end: '12:00',
  resource: null as BookingResource | null,
  title: '',
  organizerType: 'person' as OrganizerType,
  organizerName: '',
  organizerId: null as string | null,
  note: '',
})
const formMsg = ref('')
const formMsgKind = ref<'' | 'ok' | 'error'>('')
const conflictList = ref<BookingWithAttendance[]>([])
const pendingConfirm = ref(false)

watch(() => form.organizerType, (t) => {
  if (t === 'person') {
    form.organizerName = viewerName.value || form.organizerName
    form.organizerId = null
  } else if (t === 'ministry') {
    form.organizerId = form.organizerId || MINISTRIES[0].id
    form.organizerName = MINISTRIES.find(m => m.id === form.organizerId)?.label || MINISTRIES[0].label
  } else if (t === 'church') {
    form.organizerId = null
    form.organizerName = CHURCH_NAME
  }
})
watch([() => form.date, () => form.start, () => form.end, () => form.resource], () => {
  conflictList.value = []
  pendingConfirm.value = false
})

// ---------------- Диапазон (неделя Пн–Вс) ----------------
const rangeStart = ref(mondayOf(new Date()))
const rangeEnd = computed(() => addDaysISO(rangeStart.value, 6))
const rangeLabel = computed(() => formatRange(rangeStart.value, rangeEnd.value))
const filter = ref<'all' | BookingResource>('all')
const days = ref<BookingWithAttendance[]>([])

const visibleDays = computed(() => {
  if (filter.value === 'all') return days.value
  return days.value.filter(d => d.resource === filter.value)
})

const openAttendance = ref<Set<string>>(new Set())
function toggleAttendanceOpen(id: string) {
  const s = new Set(openAttendance.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  openAttendance.value = s
}

// ---------------- Загрузка ----------------
async function loadRange() {
  const data = await $fetch<BookingWithAttendance[]>('/api/bookings', {
    query: {
      from: rangeStart.value,
      to: rangeEnd.value,
      clientId: clientId.value,
      viewerName: viewerName.value,
    },
  })
  days.value = data
}

async function changeRange(deltaWeeks: number) {
  rangeStart.value = addDaysISO(rangeStart.value, deltaWeeks * 7)
  await loadRange()
}
async function goToday() {
  rangeStart.value = mondayOf(new Date())
  await loadRange()
}

async function persistViewerName() {
  const n = viewerName.value.trim()
  try {
    if (n) localStorage.setItem(NAME_KEY, n)
    else localStorage.removeItem(NAME_KEY)
  } catch {}
  await loadRange()
}

onMounted(async () => {
  await loadRange()
  const socket = useChecklistSocket()
  socket.subscribe('calendar')
  socket.onMessage(handleWs)
})

function handleWs(msg: WsServerMessage) {
  if (msg.type === 'booking-changed') {
    if (!msg.date || (msg.date >= rangeStart.value && msg.date <= rangeEnd.value)) {
      loadRange()
    }
    return
  }
  if (msg.type === 'attendance-changed') {
    applyAttendance(msg)
  }
}

function applyAttendance(msg: { eventKey: string; name: string; clientId: string | null; status: AttendanceStatus | null }) {
  const d = days.value.find(x => x.id === msg.eventKey)
  if (!d) return
  const stripName = (list: any[]) => list.filter(r => r.name !== msg.name)
  d.attendance.yes = stripName(d.attendance.yes)
  d.attendance.no = stripName(d.attendance.no)
  d.attendance.maybe = stripName(d.attendance.maybe)
  if (msg.status) {
    const rec = { name: msg.name, clientId: msg.clientId, status: msg.status }
    if (msg.status === 'yes') d.attendance.yes.push(rec)
    else if (msg.status === 'no') d.attendance.no.push(rec)
    else d.attendance.maybe.push(rec)
  }
  if (msg.name === viewerName.value.trim() && (!msg.clientId || msg.clientId === clientId.value)) {
    d.attendance.mine = msg.status
  }
}

// ---------------- Отправка формы ----------------
async function submit() {
  formMsg.value = ''
  formMsgKind.value = ''
  if (!form.date) { setErr('Укажите дату.'); return }
  if (!form.start || !form.end) { setErr('Укажите время.'); return }
  if (form.start >= form.end) { setErr('Конец должен быть позже начала.'); return }
  if (!form.resource) { setErr('Выберите помещение.'); return }
  if (!form.title.trim()) { setErr('Опишите, что происходит.'); return }

  // organizerName: для церкви — фиксированное, для остальных — из поля.
  const organizerName = form.organizerType === 'church'
    ? CHURCH_NAME
    : form.organizerName.trim()
  if (!organizerName) { setErr('Укажите, кто организует.'); return }

  if (form.mode === 'single' && !pendingConfirm.value) {
    const conflicts = days.value.filter(d =>
      d.date === form.date &&
      d.resource === form.resource &&
      !d.cancelled &&
      timesOverlap(form.start, form.end, d.start, d.end)
    )
    if (conflicts.length) {
      conflictList.value = conflicts
      pendingConfirm.value = true
      return
    }
  }

  if (form.organizerType === 'person' && viewerName.value !== organizerName) {
    viewerName.value = organizerName
    try { localStorage.setItem(NAME_KEY, viewerName.value) } catch {}
  }

  try {
    await $fetch('/api/bookings', {
      method: 'POST',
      body: {
        mode: form.mode,
        date: form.date,
        start: form.start,
        end: form.end,
        resource: form.resource,
        title: form.title.trim(),
        organizerType: form.organizerType,
        organizerName,
        organizerId: form.organizerType === 'person'
          ? clientId.value
          : form.organizerType === 'ministry'
            ? form.organizerId
            : null,
        note: form.note.trim(),
        createdBy: clientId.value,
      },
    })
    formMsg.value = form.mode === 'single' ? 'Бронь добавлена.' : 'Регулярная бронь добавлена.'
    formMsgKind.value = 'ok'
    form.title = ''
    form.note = ''
    conflictList.value = []
    pendingConfirm.value = false
    await loadRange()
  } catch (e: any) {
    setErr(e?.data?.statusMessage || 'Не удалось сохранить бронь.')
  }
}

function setErr(t: string) { formMsg.value = t; formMsgKind.value = 'error' }
function timesOverlap(a1: string, a2: string, b1: string, b2: string) { return a1 < b2 && b1 < a2 }

// ---------------- Отмена ----------------
async function cancelBooking(b: BookingWithAttendance) {
  if (b.seriesId) {
    if (!confirm('Отменить это собрание только на выбранную дату? Его можно будет вернуть.')) return
    await $fetch(`/api/series/${b.seriesId}/skip`, {
      method: 'POST',
      body: { date: b.date },
    })
  } else {
    if (!confirm('Удалить это бронирование? Оно исчезнет совсем.')) return
    const id = b.id.slice('booking:'.length)
    await $fetch(`/api/bookings/${id}`, { method: 'DELETE' })
  }
  await loadRange()
}

async function unskipSeries(b: BookingWithAttendance) {
  if (!b.seriesId) return
  await $fetch(`/api/series/${b.seriesId}/unskip`, {
    method: 'POST',
    body: { date: b.date },
  })
  await loadRange()
}

async function cancelSeries(b: BookingWithAttendance) {
  if (!b.seriesId) return
  if (!confirm('Отменить серию целиком, начиная с этой даты и дальше?')) return
  await $fetch(`/api/series/${b.seriesId}`, { method: 'DELETE' })
  await loadRange()
}

// ---------------- Присутствие ----------------
async function setAttendance(b: BookingWithAttendance, status: AttendanceStatus) {
  const name = viewerName.value.trim()
  if (!name) {
    alert('Сначала введите имя в поле «Кто отмечается».')
    return
  }
  const next = b.attendance.mine === status ? null : status
  const prev = { mine: b.attendance.mine }
  b.attendance.mine = next
  try {
    await $fetch('/api/attendance', {
      method: 'PUT',
      body: { eventKey: b.id, name, clientId: clientId.value, status: next },
    })
  } catch {
    b.attendance.mine = prev.mine
  }
}

// ---------------- Хелперы ----------------
function formatRange(a: string, b: string): string {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  const A = new Date(ya, ma-1, da), B = new Date(yb, mb-1, db)
  const sameMonth = A.getMonth() === B.getMonth()
  const fa = sameMonth ? String(A.getDate()) : A.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})
  const fb = B.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})
  return `${fa} – ${fb}`
}
function dayHeading(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m-1, d)
  return `${WEEKDAYS_RU[dt.getDay()]}, ${dt.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}`
}
function groupByDate(list: BookingWithAttendance[]): { date: string; items: BookingWithAttendance[] }[] {
  const out: { date: string; items: BookingWithAttendance[] }[] = []
  for (const b of list) {
    const last = out[out.length-1]
    if (last && last.date === b.date) last.items.push(b)
    else out.push({ date: b.date, items: [b] })
  }
  return out
}
const grouped = computed(() => groupByDate(visibleDays.value))
const todayStr = isoDate(new Date())

function attendanceSummaryLine(b: BookingWithAttendance): string {
  const y = b.attendance.yes.length
  const n = b.attendance.no.length
  const m = b.attendance.maybe.length
  if (!y && !n && !m) return 'пока никто не отметился'
  const parts: string[] = []
  if (y) parts.push(`будут ${y}`)
  if (m) parts.push(`под вопросом ${m}`)
  if (n) parts.push(`не будут ${n}`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="wrap">
    <div>
      <BrandBar />
      <h1>Календарь залов и студии</h1>
      <p class="subtitle">
        Бронирование малого зала, большого зала и студии. Разово или регулярно.
        Можно отметить своё присутствие — или присутствие другого человека,
        введя его имя в поле «Кто отмечается».
      </p>
    </div>

    <!-- ---------- Список (сверху) ---------- -->
    <div class="card">
      <div class="list-head">
        <h2 style="margin:0;">Календарь</h2>
        <div class="range-nav">
          <button type="button" @click="changeRange(-1)">◀ неделя</button>
          <span class="range-label">{{ rangeLabel }}</span>
          <button type="button" @click="changeRange(1)">неделя ▶</button>
          <button type="button" @click="goToday">сегодня</button>
        </div>
      </div>

      <div class="viewer-row">
        <div class="field">
          <label for="viewer-name">Кто отмечается</label>
          <input
            id="viewer-name"
            type="text"
            v-model="viewerName"
            placeholder="ваше имя или имя того, за кого отмечаете"
            @blur="persistViewerName"
            @keyup.enter="persistViewerName"
          >
        </div>
      </div>

      <div class="pill-group" style="margin-bottom:6px;">
        <button type="button" :aria-pressed="filter==='all'" @click="filter='all'">все</button>
        <button type="button" class="res-small"  :aria-pressed="filter==='small'"  @click="filter='small'">малый зал</button>
        <button type="button" class="res-big"    :aria-pressed="filter==='big'"    @click="filter='big'">большой зал</button>
        <button type="button" class="res-studio" :aria-pressed="filter==='studio'" @click="filter='studio'">студия</button>
      </div>

      <div v-if="!grouped.length" class="day-empty">На эту неделю броней нет.</div>

      <div v-for="g in grouped" :key="g.date" class="day-group">
        <div class="day-heading">
          {{ dayHeading(g.date) }}
          <span v-if="g.date === todayStr" class="today-tag">сегодня</span>
        </div>

        <div
          v-for="b in g.items"
          :key="b.id"
          class="booking-row"
          :class="{ cancelled: b.cancelled }"
        >
          <div class="booking-time">{{ b.start }}–{{ b.end }}</div>
          <div class="booking-body">
            <div class="booking-top">
              <span class="res-tag" :class="'res-' + b.resource">{{ RESOURCE_LABEL[b.resource] }}</span>
              <span class="booking-title" :class="{ 'strike': b.cancelled }">{{ b.title }}</span>
              <span v-if="b.seriesId && !b.cancelled" class="series-tag">регулярно</span>
              <span v-if="b.cancelled && b.seriesId" class="cancelled-tag">отменено на эту дату</span>
            </div>
            <div class="booking-meta">
              {{ b.organizerName }}
              <span class="muted">· {{ ORGANIZER_LABEL[b.organizerType] }}</span>
              <template v-if="b.note"> · <span class="muted">{{ b.note }}</span></template>
            </div>

            <!-- Присутствие -->
            <div class="attendance" v-if="!b.cancelled">
              <button
                type="button"
                class="att-btn att-yes"
                :aria-pressed="b.attendance.mine === 'yes' ? 'true' : 'false'"
                @click="setAttendance(b, 'yes')"
                title="будет"
              >+</button>
              <button
                type="button"
                class="att-btn att-maybe"
                :aria-pressed="b.attendance.mine === 'maybe' ? 'true' : 'false'"
                @click="setAttendance(b, 'maybe')"
                title="под вопросом"
              >?</button>
              <button
                type="button"
                class="att-btn att-no"
                :aria-pressed="b.attendance.mine === 'no' ? 'true' : 'false'"
                @click="setAttendance(b, 'no')"
                title="не будет"
              >−</button>

              <button
                type="button"
                class="att-summary"
                @click="toggleAttendanceOpen(b.id)"
              >
                {{ attendanceSummaryLine(b) }}
                <span class="caret">{{ openAttendance.has(b.id) ? '▾' : '▸' }}</span>
              </button>
            </div>

            <!-- Действия: удалить разовую, отменить на дату, вернуть, отменить серию -->
            <div class="actions-row" v-if="!b.cancelled || b.seriesId">
              <button
                v-if="!b.seriesId"
                type="button"
                class="icon-btn"
                title="Удалить бронь"
                @click="cancelBooking(b)"
              >✕ удалить</button>

              <template v-else>
                <button
                  v-if="!b.cancelled"
                  type="button"
                  class="icon-btn"
                  title="Отменить только на эту дату"
                  @click="cancelBooking(b)"
                >✕ на дату</button>

                <button
                  v-else
                  type="button"
                  class="icon-btn icon-restore"
                  title="Вернуть эту дату — отметки присутствия сохранятся"
                  @click="unskipSeries(b)"
                >↺ вернуть</button>

                <button
                  v-if="!b.cancelled"
                  type="button"
                  class="icon-btn"
                  title="Отменить серию целиком"
                  @click="cancelSeries(b)"
                >✕ серию</button>
              </template>
            </div>

            <!-- Раскрытый список присутствия -->
            <div v-if="openAttendance.has(b.id)" class="att-detail">
              <div v-if="b.attendance.yes.length" class="att-group">
                <span class="att-group-title att-yes-title">будут</span>
                <span v-for="r in b.attendance.yes" :key="r.name" class="att-name">{{ r.name }}</span>
              </div>
              <div v-if="b.attendance.maybe.length" class="att-group">
                <span class="att-group-title att-maybe-title">под вопросом</span>
                <span v-for="r in b.attendance.maybe" :key="r.name" class="att-name">{{ r.name }}</span>
              </div>
              <div v-if="b.attendance.no.length" class="att-group">
                <span class="att-group-title att-no-title">не будут</span>
                <span v-for="r in b.attendance.no" :key="r.name" class="att-name">{{ r.name }}</span>
              </div>
              <div v-if="!b.attendance.yes.length && !b.attendance.maybe.length && !b.attendance.no.length" class="day-empty">
                пока никто не отметился
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ---------- Форма (снизу) ---------- -->
    <div class="card">
      <h2>Новая бронь</h2>
      <div class="form-grid">
        <div class="field span-2">
          <label>Тип брони</label>
          <div class="pill-group">
            <button type="button" :aria-pressed="form.mode==='single'" @click="form.mode='single'">разово</button>
            <button type="button" :aria-pressed="form.mode==='weekly'" @click="form.mode='weekly'">каждую неделю</button>
            <button type="button" :aria-pressed="form.mode==='biweekly'" @click="form.mode='biweekly'">через неделю</button>
          </div>
        </div>

        <div class="field">
          <label for="bk-date">{{ form.mode === 'single' ? 'Дата' : 'Первая дата' }}</label>
          <input id="bk-date" type="date" v-model="form.date">
        </div>
        <div class="field" style="display:flex; gap:10px;">
          <div style="flex:1;">
            <label for="bk-start">Начало</label>
            <input id="bk-start" type="time" v-model="form.start">
          </div>
          <div style="flex:1;">
            <label for="bk-end">Конец</label>
            <input id="bk-end" type="time" v-model="form.end">
          </div>
        </div>

        <div class="field span-2">
          <label>Помещение</label>
          <div class="pill-group">
            <button
              v-for="r in (['small','big','studio'] as BookingResource[])"
              :key="r"
              type="button"
              :class="['res-' + r]"
              :aria-pressed="form.resource === r ? 'true' : 'false'"
              @click="form.resource = r"
            >{{ RESOURCE_LABEL[r] }}</button>
          </div>
        </div>

        <div class="field span-2">
          <label>От чьего имени</label>
          <div class="pill-group">
            <button
              v-for="t in (['person','ministry','church'] as OrganizerType[])"
              :key="t"
              type="button"
              :aria-pressed="form.organizerType === t ? 'true' : 'false'"
              @click="form.organizerType = t"
            >{{ ORGANIZER_LABEL[t] }}</button>
          </div>
        </div>

        <div v-if="form.organizerType === 'ministry'" class="field span-2">
          <label>Служение</label>
          <div class="pill-group">
            <button
              v-for="m in MINISTRIES"
              :key="m.id"
              type="button"
              :aria-pressed="form.organizerId === m.id ? 'true' : 'false'"
              @click="form.organizerId = m.id; form.organizerName = m.label"
            >{{ m.label }}</button>
          </div>
        </div>

        <!-- Название церкви фиксированное: «Источник Жизни».
             Для церкви поле ввода не показываем. -->
        <div v-if="form.organizerType !== 'church'" class="field span-2">
          <label for="bk-orgname">
            {{ form.organizerType === 'person' ? 'ФИО' : 'Название служения' }}
          </label>
          <input id="bk-orgname" type="text" v-model="form.organizerName"
                 placeholder="ФИО или название">
        </div>
        <div v-else class="field span-2">
          <label>Церковь</label>
          <div class="church-name">{{ CHURCH_NAME }}</div>
        </div>

        <div class="field span-2">
          <label for="bk-title">Что происходит</label>
          <input id="bk-title" type="text" v-model="form.title"
                 placeholder="напр. саундчек, утренняя молитва, конференция">
        </div>

        <div class="field span-2">
          <label for="bk-note">Комментарий (необязательно)</label>
          <input id="bk-note" type="text" v-model="form.note" placeholder="детали, если нужно">
        </div>
      </div>

      <div v-if="conflictList.length" class="conflict-box">
        <b>Пересечение по времени в этом же помещении:</b>
        <ul style="margin:6px 0 0; padding-left:18px;">
          <li v-for="c in conflictList" :key="c.id">
            {{ c.start }}–{{ c.end }} — {{ c.title }} ({{ c.organizerName }})
          </li>
        </ul>
        <div style="margin-top:8px;">Нажмите ещё раз, чтобы всё равно добавить.</div>
      </div>

      <div class="submit-row">
        <button
          type="button"
          class="submit-btn"
          :class="{ 'warn-btn': pendingConfirm }"
          @click="submit"
        >
          {{ pendingConfirm ? 'всё равно добавить' : 'добавить бронь' }}
        </button>
        <span class="form-msg" :class="formMsgKind">{{ formMsg }}</span>
      </div>
    </div>

    <footer>брони синхронизируются между всеми устройствами команды</footer>
  </div>
</template>
