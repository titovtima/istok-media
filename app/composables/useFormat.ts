import type { DayKey } from '~~/shared/types'

const DOW_TO_KEY: DayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday',
]

const DAY_LABEL: Record<DayKey, string> = {
  monday: 'Понедельник',
  tuesday: 'Вторник',
  wednesday: 'Среда',
  thursday: 'Четверг',
  friday: 'Пятница',
  saturday: 'Суббота',
  sunday: 'Воскресенье',
}

export function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function dayKeyForDate(date: Date | string): DayKey {
  const d = typeof date === 'string' ? parseISODateLocal(date) : date
  return DOW_TO_KEY[d.getDay()]
}

export function dayLabel(day: DayKey): string {
  return DAY_LABEL[day] ?? day
}

export function formatDateLabel(iso: string): string {
  const d = parseISODateLocal(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function labelWithOutfit(label: string, outfit: string): string {
  const v = outfit && outfit.trim() ? outfit : 'не указан'
  return label.replace('{outfit}', v)
}
