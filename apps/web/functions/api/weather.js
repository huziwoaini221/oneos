import { json } from './_lib.js'

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  const city = url.searchParams.get('city')
  const key = env.OPENWEATHER_API_KEY
  if (!key) return json({ error: 'OPENWEATHER_API_KEY not configured' }, 500)
  if (!city) return json({ error: 'missing city param' }, 400)

  const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${key}`)
  if (!geoRes.ok) {
    return json({ error: `geocoding ${geoRes.status}: ${geoRes.statusText}` }, 502)
  }
  const geo = await geoRes.json()
  if (!geo.length) return json({ error: `city not found: ${city}` }, 404)
  const { lat, lon, name } = geo[0]

  const target = `https://api.openweathermap.org/data/4.0/onecall/current?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=zh_cn`
  const res = await fetch(target)
  if (!res.ok) {
    return json({ error: `openweather ${res.status}: ${res.statusText}` }, 502)
  }
  const data = await res.json()
  const cur = data.data?.[0] || {}

  const wind = cur.wind_deg != null && cur.wind_speed != null
    ? `${windDirection(cur.wind_deg)} ${Math.round(cur.wind_speed)} 级`
    : null

  return json({
    city: name || city,
    temp: Math.round(cur.temp ?? 0),
    condition: cur.weather?.[0]?.description || '未知',
    humidity: cur.humidity ?? null,
    wind,
    updated_at: new Date().toISOString()
  })
}

function windDirection(deg) {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  const idx = Math.round(deg / 45) % 8
  return `${dirs[idx]}风`
}
