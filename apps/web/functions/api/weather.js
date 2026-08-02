import { json } from './_lib.js'

export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  const city = url.searchParams.get('city')
  if (!city) return json({ error: 'missing city param' }, 400)

  const target = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
  const res = await fetch(target)
  if (!res.ok) {
    return json({ error: `wttr.in ${res.status}: ${res.statusText}` }, 502)
  }
  const data = await res.json()

  const area = data.nearest_area?.[0]
  const cur = data.current_condition?.[0] || {}

  const wind = cur.winddir16Point && cur.windspeedKmph != null
    ? `${windDirZh(cur.winddir16Point)} ${Math.round(cur.windspeedKmph / 3.6)} 级`
    : null

  return json({
    city: area?.areaName?.[0]?.value || city,
    temp: cur.temp_C != null ? Math.round(cur.temp_C) : null,
    condition: weatherZh((cur.weatherDesc?.[0]?.value || '').trim()),
    humidity: cur.humidity != null ? Math.round(cur.humidity) : null,
    wind,
    updated_at: new Date().toISOString()
  })
}

const WEATHER_MAP = {
  'Sunny': '晴', 'Clear': '晴', 'Partly Cloudy': '多云', 'Overcast': '阴',
  'Mist': '薄雾', 'Fog': '雾', 'Light Rain': '小雨', 'Rain': '雨',
  'Heavy Rain': '大雨', 'Drizzle': '毛毛雨', 'Thunderstorm': '雷阵雨',
  'Snow': '雪', 'Light Snow': '小雪', 'Showers': '阵雨', 'Windy': '大风',
  'Cloudy': '多云', 'Freezing Fog': '冻雾', 'Light Drizzle': '毛毛雨',
  'Moderate Rain': '中雨', 'Patchy Rain': '零星小雨', 'Light Sleet': '小冻雨',
  'Sleet': '冻雨', 'Heavy Snow': '大雪', 'Moderate Snow': '中雪'
}

function weatherZh(desc) {
  if (!desc) return '未知'
  const key = desc.trim()
  return WEATHER_MAP[key] || key
}

function windDirZh(dir16) {
  const map = { N: '北', NNE: '北东北', NE: '东北', ENE: '东东北', E: '东', ESE: '东东南', SE: '东南', SSE: '南东南', S: '南', SSW: '南西南', SW: '西南', WSW: '西西南', W: '西', WNW: '西西北', NW: '西北', NNW: '北西北' }
  return `${map[dir16] || dir16}风`
}
