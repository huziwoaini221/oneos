// API 封装。token 来自 URL ?key= 或 localStorage，用户可随时清除。
const TOKEN_KEY = 'lifehub_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function tokenFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const key = params.get('key')
  if (key) {
    setToken(key)
    const clean = window.location.pathname + window.location.hash
    window.history.replaceState(null, '', clean)
    return true
  }
  return false
}

export async function api(path, options = {}) {
  const token = getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const get = (path) => api(path)
export const post = (path, data) => api(path, { method: 'POST', body: JSON.stringify(data) })
export const patch = (path, data) => api(path, { method: 'PATCH', body: JSON.stringify(data) })
export const del = (path) => api(path, { method: 'DELETE' })
