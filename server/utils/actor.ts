import { query } from './db'

// ---------------------------------------------------------------------------
// actor:
//   • 'login'      — залогиненный пользователь
//   • 'anon:<имя>' — аноним
// Отображаемое имя вычисляется на сервере:
//   • для логина — full_name из users (или сам логин, если пользователь удалён)
//   • для anon:  — часть после префикса
// ---------------------------------------------------------------------------

const ANON_PREFIX = 'anon:'

export function isAnonActor(actor: string): boolean {
  return actor.startsWith(ANON_PREFIX)
}

export function anonActorFromName(name: string): string {
  const n = (name || '').trim()
  return ANON_PREFIX + (n || 'unknown')
}

// Быстрое отображение без обращения к БД: для anon — срезаем префикс;
// для логина — вернём сам логин (это будет перезаписано resolveActors).
export function displayNameSync(actor: string): string {
  return isAnonActor(actor) ? actor.slice(ANON_PREFIX.length) : actor
}

// Возвращает map actor → displayName. Один SQL-запрос на весь список
// зарегистрированных логинов; анонимы разрешаются локально.
export async function resolveActors(actors: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const logins = new Set<string>()
  for (const a of actors) {
    if (!a) {
      console.warn('[resolveActors] пустой actor — пропускаю')
      continue
    }
    if (isAnonActor(a)) {
      const tail = a.slice(ANON_PREFIX.length)
      result.set(a, tail || '—')
      if (!tail) console.warn(`[resolveActors] anon без имени: "${a}"`)
    } else {
      logins.add(a)
    }
  }

  if (logins.size) {
    const list = Array.from(logins)
    const placeholders = list.map((_, i) => `$${i + 1}`).join(', ')
    const rows = await query<{ login: string; full_name: string }>(
      `SELECT login, full_name FROM users WHERE login IN (${placeholders})`,
      list
    )
    for (const r of rows) result.set(r.login, r.full_name || r.login)
    // логины без пользователя (удалённые) — показываем как есть
    for (const l of list) {
      if (!result.has(l)) {
        console.warn(`[resolveActors] пользователь "${l}" не найден, показываю логин`)
        result.set(l, l)
      }
    }
  }
  return result
}
