import { defineStore } from 'pinia'
import { watch } from 'vue'
import type {
  CheckEntry, DayKey, RecentService, ServiceRecord, TemplateItem,
  WsServerMessage,
} from '~~/shared/types'
import { dayKeyForDate } from '~/composables/useFormat'

function pad2(n: number){ return n < 10 ? '0'+n : ''+n }
function toISODate(d: Date){ return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()) }

function nextWeekday(from: Date, targetDow: number){
  const d = new Date(from)
  let diff = (targetDow - d.getDay() + 7) % 7
  if (diff === 0) diff = 7
  d.setDate(d.getDate() + diff)
  return d
}

function buildServiceId(date: string, slot: number): string {
  return slot <= 1 ? date : `${date}#${slot}`
}

const NAME_KEY = 'mc_name'
const localEcho = new Map<string, string>()

function echoKey(serviceId: string, templateId: string) {
  return `${serviceId}::${templateId}`
}

export const useChecklistStore = defineStore('checklist', {
  state: () => {
    const today = new Date()
    const nextWed = nextWeekday(today, 3)
    const nextSun = nextWeekday(today, 0)
    const isWed = nextWed < nextSun
    const date = toISODate(isWed ? nextWed : nextSun)

    return {
      templates: { tech: [] as TemplateItem[] },
      editMode: { tech: false },
      serviceId: date,
      date,
      slot: 1,                         // текущий выбранный slot
      dayServices: [] as RecentService[], // собрания на выбранную дату
      outfit: '',
      checks: {} as Record<string, CheckEntry>,
      recent: [] as RecentService[],
      localName: (import.meta.client && localStorage.getItem(NAME_KEY)) || '',
      loaded: false,
      wsConnected: false,
      wsPeers: 0,
      socket: null as null | {
        subscribe: (id: string) => void
        onMessage: (h: (m: WsServerMessage) => void) => () => void
        isConnected: { value: boolean }
        peersCount: { value: number }
      },
      _wsUnwatch: null as null | (() => void),
    }
  },
  getters: {
    techTotal: (s) => s.templates.tech.length,
    techDone(s) {
      return s.templates.tech.reduce((n, t) => n + (s.checks[t.id]?.done ? 1 : 0), 0)
    },
    currentDayKey(s): DayKey {
      return dayKeyForDate(s.date)
    },
  },
  actions: {
    async bootstrap() {
      const [tpl, recent] = await Promise.all([
        $fetch<{ tech: TemplateItem[] }>('/api/templates'),
        $fetch<RecentService[]>('/api/services'),
      ])
      this.templates = tpl
      this.recent = recent
      await this.loadDate(this.date)
      if (import.meta.client) this.connectSocket()
      this.loaded = true
    },

    connectSocket() {
      const socket = useChecklistSocket()
      this.socket = socket as any
      this.wsConnected = socket.isConnected.value
      this.wsPeers = socket.peersCount.value
      socket.onMessage((msg) => this.applyServerMessage(msg))
      socket.subscribe(this.serviceId)

      const stop1 = watch(
        () => socket.isConnected.value,
        (v) => { this.wsConnected = v },
        { immediate: true },
      )
      const stop2 = watch(
        () => socket.peersCount.value,
        (v) => { this.wsPeers = v },
        { immediate: true },
      )
      this._wsUnwatch = () => { stop1(); stop2() }
    },

    applyServerMessage(msg: WsServerMessage) {
      if (msg.type === 'check-update') {
        if (msg.serviceId !== this.serviceId) return
        const key = echoKey(msg.serviceId, msg.templateId)
        if (localEcho.get(key) === '*') { localEcho.delete(key); return }
        this.checks[msg.templateId] = { done: msg.done, by: msg.by, at: msg.at }
        return
      }
      if (msg.type === 'service-meta-update') {
        if (msg.serviceId !== this.serviceId) return
        this.outfit = msg.outfit
        return
      }
      if (msg.type === 'presence') {
        if (msg.serviceId !== this.serviceId) return
        this.wsPeers = msg.count
        return
      }
    },

    // Загружает список собраний на дату и подгружает первое (или указанный slot).
    async loadDate(date: string, preferSlot?: number) {
      this.date = date

      const services = await $fetch<RecentService[]>('/api/services', {
        query: { date },
      }).catch(() => [] as RecentService[])

      // Если на дату ещё нет ни одного собрания — создаём первое,
      // чтобы пользователь сразу мог начать отмечать.
      let list = services
      if (!list.length) {
        const created = await $fetch<RecentService>('/api/services', {
          method: 'POST',
          body: { date },
        })
        list = [created]
        // обновим и историю в шапке
        await this.touchRecent()
      } else {
        this.dayServices = list
      }
      this.dayServices = list

      const slot = preferSlot && list.some(s => s.slot === preferSlot)
        ? preferSlot
        : list[0].slot

      await this.selectSlot(slot)
    },

    async selectSlot(slot: number) {
      this.slot = slot
      const service = this.dayServices.find(s => s.slot === slot)
      const serviceId = service ? service.id : buildServiceId(this.date, slot)
      this.serviceId = serviceId

      const data = await $fetch<ServiceRecord | null>(`/api/services/${serviceId}`)
        .catch(() => null)

      if (data) {
        this.outfit = data.outfit || ''
        this.checks = data.checks || {}
      } else {
        this.outfit = ''
        this.checks = {}
      }
      if (this.socket) this.socket.subscribe(this.serviceId)
    },

    async addService() {
      const created = await $fetch<RecentService>('/api/services', {
        method: 'POST',
        body: { date: this.date },
      })
      // перезагрузим список собраний на дату
      this.dayServices = await $fetch<RecentService[]>('/api/services', {
        query: { date: this.date },
      })
      await this.touchRecent()
      await this.selectSlot(created.slot)
    },

    async saveServiceMeta() {
      await $fetch(`/api/services/${this.serviceId}`, {
        method: 'PUT',
        body: { date: this.date, outfit: this.outfit },
      })
      await this.touchRecent()
    },

    async toggle(templateId: string, done: boolean) {
      const by = this.ensureNameInteractive()
      const at = nowHM()
      this.checks[templateId] = { done, by: by || null, at: done ? at : null }

      const key = echoKey(this.serviceId, templateId)
      localEcho.set(key, '*')
      setTimeout(() => { if (localEcho.get(key) === '*') localEcho.delete(key) }, 4000)

      await $fetch(`/api/services/${this.serviceId}/check`, {
        method: 'PUT',
        body: {
          templateId, done,
          by: by || null,
          at: done ? at : null,
        },
      })
    },

    async addTemplate(module: 'tech', grp: string, label: string) {
      const item = await $fetch<TemplateItem>('/api/templates', {
        method: 'POST', body: { module, grp, label },
      })
      this.templates[module].push(item)
    },

    async updateTemplate(id: string, patch: { grp?: string; label?: string }, module: 'tech') {
      const item = await $fetch<TemplateItem>(`/api/templates/${id}`, {
        method: 'PATCH', body: patch,
      })
      const list = this.templates[module]
      const idx = list.findIndex(t => t.id === id)
      if (idx >= 0) list[idx] = item
    },

    async removeTemplate(id: string, module: 'tech') {
      await $fetch(`/api/templates/${id}`, { method: 'DELETE' })
      this.templates[module] = this.templates[module].filter(t => t.id !== id)
      delete this.checks[id]
    },

    async touchRecent() {
      this.recent = await $fetch<RecentService[]>('/api/services')
    },

    ensureName(): string { return this.localName },
    setName(name: string) {
      this.localName = name.trim()
      try {
        if (this.localName) localStorage.setItem(NAME_KEY, this.localName)
        else localStorage.removeItem(NAME_KEY)
      } catch { /* приватный режим */ }
    },
    ensureNameInteractive(): string {
      if (this.localName) return this.localName
      if (!import.meta.client) return ''
      const name = window.prompt('Ваше имя (чтобы было видно, кто проверил пункт):', '') || ''
      if (name) this.setName(name)
      return this.localName
    },
  },
})

function nowHM(){
  const d = new Date()
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}
