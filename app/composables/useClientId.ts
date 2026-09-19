const KEY = 'mc_client_id'

export function useClientId(): string {
  if (!import.meta.client) return ''
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'c_anon'
  }
}
