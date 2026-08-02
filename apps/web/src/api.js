// API 封装。token 由构建时注入（VITE_LIFEHUB_TOKEN），对用户可见，仅作简单保护。
const TOKEN = import.meta.env.VITE_LIFEHUB_TOKEN || ''

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
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
