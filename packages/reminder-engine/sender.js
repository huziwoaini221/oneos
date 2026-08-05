// 发送器 + 消息构建。
// sendTelegram：Telegram Bot API sendMessage。
// sendWeCom：企业微信应用消息。
// send：按 default_channel 分发（双通道可同时启用）。
// buildDailyDigest：time 型规则的每日晨报（今日任务 + 今日日程）。
// buildMessage：data 型规则的按来源消息。

import { localParts, localWallToUtc } from './scheduler.js'

export async function sendTelegram(env, settings, text) {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = settings?.telegram_chat_id
  if (!token || !chatId) throw new Error('telegram not configured (need TELEGRAM_BOT_TOKEN and chat_id)')
  if (!settings.telegram_enabled) return
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Number(chatId), text })
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`telegram send failed (${res.status}): ${err}`)
  }
  return res.json()
}

// 统一发送：default_channel = 'telegram' 只发 TG；'wecom' 只发企微；'both' 双通道都发。
export async function send(env, settings, text) {
  const channels = (settings?.default_channel || 'telegram').split(',').map(s => s.trim()).filter(Boolean)
  const results = []
  for (const ch of channels) {
    if (ch === 'telegram') results.push(await sendTelegram(env, settings, text))
    else if (ch === 'wecom') results.push(await sendWeCom(env, settings, text))
  }
  return results
}

export async function sendWeCom(env, settings, text) {
  const webhook = settings?.wecom_webhook
  if (!webhook) throw new Error('wecom not configured (need wecom_webhook)')
  if (!settings.wecom_enabled) return

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: text } })
  })
  const data = await res.json().catch(() => ({}))
  if (data.errcode) {
    throw new Error(`wecom send failed: ${data.errmsg}`)
  }
  return data
}

export async function buildDailyDigest(db, settings, now) {
  const tz = settings.timezone
  const p = localParts(now, tz)
  const dayStart = localWallToUtc({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 }, tz)
  const dayEnd = localWallToUtc({ year: p.year, month: p.month, day: p.day, hour: 23, minute: 59 }, tz)
  const tomorrowStart = localWallToUtc({ year: p.year, month: p.month, day: p.day + 1, hour: 0, minute: 0 }, tz)
  const tomorrowEnd = localWallToUtc({ year: p.year, month: p.month, day: p.day + 1, hour: 23, minute: 59 }, tz)

  const { results: tasks } = await db.prepare(
    "SELECT title, description, deadline FROM tasks WHERE status IN ('pending', 'doing') AND deadline IS NOT NULL AND deadline >= ? AND deadline <= ?"
  ).bind(dayStart.toISOString(), dayEnd.toISOString()).all()

  const { results: events } = await db.prepare(
    'SELECT title, start_time, location FROM events WHERE start_time >= ? AND start_time <= ?'
  ).bind(dayStart.toISOString(), dayEnd.toISOString()).all()

  const { results: tomorrowTasks } = await db.prepare(
    "SELECT title, description, deadline FROM tasks WHERE status IN ('pending', 'doing') AND deadline IS NOT NULL AND deadline >= ? AND deadline <= ?"
  ).bind(tomorrowStart.toISOString(), tomorrowEnd.toISOString()).all()

  const { results: tomorrowEvents } = await db.prepare(
    'SELECT title, start_time, location FROM events WHERE start_time >= ? AND start_time <= ?'
  ).bind(tomorrowStart.toISOString(), tomorrowEnd.toISOString()).all()

  const lines = [`【每日晨报】${p.month}月${p.day}日`]
  const weekdayZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][p.weekday]
  lines[0] = `【每日晨报】${p.month}月${p.day}日 ${weekdayZh}`

  const weather = await fetchWeather(settings.weather_city)
  if (weather) lines.push(`\n🌤 天气: ${weather.city} ${weather.condition} ${weather.temp}°C${weather.humidity != null ? ` 湿度${weather.humidity}%` : ''}`)

  if (tasks.length) {
    lines.push('\n今日任务:')
    for (const task of tasks) {
      lines.push(`  - ${task.title} (${fmtTime(task.deadline, tz)})`)
      if (task.description) lines.push(`    ${task.description}`)
    }
  }
  if (events.length) {
    lines.push('\n今日日程:')
    for (const event of events) lines.push(`  - ${event.title} ${fmtTime(event.start_time, tz)}${event.location ? ` @${event.location}` : ''}`)
  }
  if (!tasks.length && !events.length) lines.push('\n今天没有任务和日程')

  const finance = await financeSummary(db, settings, now)
  if (finance) lines.push(`\n${finance}`)

  if (tomorrowTasks.length || tomorrowEvents.length) {
    lines.push(`\n📌 明日预览: ${tomorrowTasks.length} 个任务 · ${tomorrowEvents.length} 个日程`)
  }

  return lines.join('\n')
}

async function fetchWeather(city) {
  if (!city) return null
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
    if (!res.ok) return null
    const data = await res.json()
    const area = data.nearest_area?.[0]
    const cur = data.current_condition?.[0] || {}
    return {
      city: area?.areaName?.[0]?.value || city,
      temp: cur.temp_C != null ? Math.round(cur.temp_C) : null,
      condition: weatherZh((cur.weatherDesc?.[0]?.value || '').trim()),
      humidity: cur.humidity != null ? Math.round(cur.humidity) : null
    }
  } catch {
    return null
  }
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

async function financeSummary(db, settings, now) {
  const tz = settings.timezone
  const p = localParts(now, tz)
  const monthStart = localWallToUtc({ year: p.year, month: p.month, day: 1, hour: 0, minute: 0 }, tz)
  const nextMonth = p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 }
  const monthEnd = localWallToUtc({ year: nextMonth.year, month: nextMonth.month, day: 1, hour: 0, minute: 0 }, tz)
  const yearStart = localWallToUtc({ year: p.year, month: 1, day: 1, hour: 0, minute: 0 }, tz)
  const nextYear = localWallToUtc({ year: p.year + 1, month: 1, day: 1, hour: 0, minute: 0 }, tz)

  const { results: month } = await db.prepare(
    'SELECT SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS income, SUM(CASE WHEN amount >= 0 THEN amount ELSE 0 END) AS expense FROM expenses WHERE date >= ? AND date < ?'
  ).bind(monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)).all()

  const { results: year } = await db.prepare(
    'SELECT SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS income, SUM(CASE WHEN amount >= 0 THEN amount ELSE 0 END) AS expense FROM expenses WHERE date >= ? AND date < ?'
  ).bind(yearStart.toISOString().slice(0, 10), nextYear.toISOString().slice(0, 10)).all()

  const m = month[0] || {}
  const y = year[0] || {}
  if (!m.income && !m.expense && !y.income && !y.expense) return null
  const fmt = n => `¥${Math.round(n || 0)}`
  return `💰 收支: 本月收入 ${fmt(m.income)} 支出 ${fmt(m.expense)} | 本年收入 ${fmt(y.income)} 支出 ${fmt(y.expense)}`
}

export function buildMessage(rule, item, settings) {
  const tz = settings.timezone
  switch (rule.source) {
    case 'contacts': {
      const days = Math.floor((Date.now() - new Date(item.last_contact).getTime()) / 86400000)
      return `【${rule.name}】\n${item.name} 已 ${days} 天未联系`
    }
    case 'tasks':
      return `【${rule.name}】\n任务 "${item.title}" 即将到期`
    case 'events':
      return `【${rule.name}】\n"${item.title}" 将于 ${fmtTime(item.start_time, tz)} 开始${item.location ? ` @${item.location}` : ''}`
    case 'finance':
      return `【${rule.name}】\n${item.category} 本月支出 ${item.total}，超出预算`
    default:
      return `【${rule.name}】\n有新的提醒`
  }
}

function fmtTime(iso, timezone) {
  return new Date(iso).toLocaleString('zh-CN', {
    timeZone: timezone,
    hour12: false,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
