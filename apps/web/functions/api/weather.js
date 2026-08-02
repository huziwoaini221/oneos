import { json } from './_lib.js'

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  const city = url.searchParams.get('city')
  const key = env.OPENWEATHER_API_KEY
  if (!key) return json({ error: 'OPENWEATHER_API_KEY not configured' }, 500)
  if (!city) return json({ error: 'missing city param' }, 400)

  const target = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${key}&units=metric&lang=zh_cn`
  const res = await fetch(target)
  if (!res.ok) {
    return json({ error: `openweather ${res.status}: ${res.statusText}` }, 502)
  }
  const data = await res.json()

  const wind = data.wind && data.wind.deg != null
    ? `${windDirection(data.wind.deg)} ${Math.round(data.wind.speed)} 级`
    : null

  return json({
    city: data.name,
    temp: Math.round(data.main?.temp ?? 0),
    condition: data.weather?.[0]?.description || '未知',
    humidity: data.main?.humidity ?? null,
    wind,
    updated_at: new Date().toISOString()
  })
}

function windDirection(deg) {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  const idx = Math.round(deg / 45) % 8
  return `${dirs[idx]}风`
}
