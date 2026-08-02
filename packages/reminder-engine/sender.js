// 发送器 + 消息构建。
// sendTelegram：Telegram Bot API sendMessage。
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

export async function buildDailyDigest(db, settings, now) {
  const tz = settings.timezone
  const p = localParts(now, tz)
  const dayStart = localWallToUtc({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 }, tz)
  const dayEnd = localWallToUtc({ year: p.year, month: p.month, day: p.day, hour: 23, minute: 59 }, tz)

  const { results: tasks } = await db.prepare(
    "SELECT title, deadline FROM tasks WHERE status IN ('pending', 'doing') AND deadline IS NOT NULL AND deadline >= ? AND deadline <= ?"
  ).bind(dayStart.toISOString(), dayEnd.toISOString()).all()

  const { results: events } = await db.prepare(
    'SELECT title, start_time, location FROM events WHERE start_time >= ? AND start_time <= ?'
  ).bind(dayStart.toISOString(), dayEnd.toISOString()).all()

  const lines = []
  if (tasks.length) {
    lines.push('今日任务:')
    for (const task of tasks) lines.push(`  - ${task.title} (${fmtTime(task.deadline, tz)})`)
  }
  if (events.length) {
    lines.push('今日日程:')
    for (const event of events) lines.push(`  - ${event.title} ${fmtTime(event.start_time, tz)}${event.location ? ` @${event.location}` : ''}`)
  }
  if (!lines.length) lines.push('今天没有任务和日程')
  return `【每日晨报】\n${lines.join('\n')}`
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
