// 引擎入口。串联：settings -> 启用规则 -> (time: next_fire_at / data: loader+evaluator+dedup) -> sender -> logs。
// 零依赖，Pages Functions 与 Worker 均可调用：runReminderEngine(env)。

import { loadCandidates } from './loader.js'
import { evaluate } from './evaluator.js'
import { canNotify } from './deduplicator.js'
import { sendTelegram, buildMessage, buildDailyDigest } from './sender.js'
import { nextFireAt, deriveNotifyInterval, localParts } from './scheduler.js'

export async function runReminderEngine(env) {
  const db = env.DB
  const settings = await getSettings(db)

  const { results: rules } = await db.prepare('SELECT * FROM reminder_rules WHERE enabled = 1').all()

  for (const rule of rules) {
    try {
      if (rule.type === 'time') {
        await processTimeRule(db, env, settings, rule)
      } else if (rule.type === 'data' && rule.source === 'birthdays') {
        await processBirthdayRule(db, env, settings, rule)
      } else if (rule.type === 'data') {
        await processDataRule(db, env, settings, rule)
      }
    } catch (err) {
      await logReminder(db, rule, 'rule', rule.id, 'failed', null)
      console.error(`[reminder] rule ${rule.id} failed:`, err.message)
    }
  }
}

async function getSettings(db) {
  const row = await db.prepare('SELECT * FROM settings WHERE id = 1').first()
  return row || { timezone: 'Asia/Shanghai', telegram_chat_id: null, telegram_enabled: 1, default_channel: 'telegram' }
}

async function processTimeRule(db, env, settings, rule) {
  const now = new Date()

  if (!rule.next_fire_at) {
    const next = nextFireAt(now, settings.timezone, rule.schedule)
    if (!next) throw new Error(`unsupported schedule: ${rule.schedule}`)
    await db.prepare('UPDATE reminder_rules SET next_fire_at = ? WHERE id = ?').bind(next.toISOString(), rule.id).run()
    return
  }

  if (now.getTime() < new Date(rule.next_fire_at).getTime()) return

  const intervalSec = deriveNotifyInterval(rule.schedule)
  const objectId = String(rule.id)
  if (await canNotify(db, rule, 'rule', objectId, intervalSec)) {
    const text = await buildDailyDigest(db, settings, now)
    await sendTelegram(env, settings, text)
    await logReminder(db, rule, 'rule', objectId, 'sent', now.toISOString())

    const next = nextFireAt(now, settings.timezone, rule.schedule)
    if (next) {
      await db.prepare('UPDATE reminder_rules SET next_fire_at = ? WHERE id = ?').bind(next.toISOString(), rule.id).run()
    }
  }
  // 未发送（去重窗口未过）时保持 next_fire_at 不变，下一次 tick 重新判断，
  // 避免把已过触发点推进到次日而跳过当天。
}

async function processBirthdayRule(db, env, settings, rule) {
  const now = new Date()
  const p = localParts(now, settings.timezone || 'Asia/Shanghai')
  const month = String(p.month).padStart(2, '0')
  const day = String(p.day).padStart(2, '0')
  const { results: birthdays } = await db.prepare(
    "SELECT * FROM contacts WHERE birthday IS NOT NULL AND substr(birthday, 6, 5) = ?"
  ).bind(`${month}-${day}`).all()

  const intervalSec = 86400
  for (const person of birthdays) {
    const objectId = String(person.id)
    if (!(await canNotify(db, rule, 'birthdays', objectId, intervalSec))) continue
    const text = `【${rule.name}】\n🎂 今天是 ${person.name} 的生日！${person.phone ? `\n📞 ${person.phone}` : ''}${person.address ? `\n📍 ${person.address}` : ''}`
    await sendTelegram(env, settings, text)
    await logReminder(db, rule, 'birthdays', objectId, 'sent', now.toISOString())
  }
}

async function processDataRule(db, env, settings, rule) {
  const now = new Date()
  const cond = parseCondition(rule)
  const intervalSec = cond.notify_interval || 86400
  const items = await loadCandidates(db, rule, now, settings.timezone)

  for (const item of items) {
    if (!evaluate(rule, item, now)) continue
    const objectType = rule.source
    const objectId = String(item.id)
    if (!(await canNotify(db, rule, objectType, objectId, intervalSec))) continue
    const text = buildMessage(rule, item, settings)
    await sendTelegram(env, settings, text)
    await logReminder(db, rule, objectType, objectId, 'sent', now.toISOString())
  }
}

function parseCondition(rule) {
  try {
    return JSON.parse(rule.condition_json || '{}')
  } catch {
    return {}
  }
}

export async function logReminder(db, rule, objectType, objectId, status, sentTime) {
  await db.prepare(
    'INSERT INTO reminder_logs (rule_id, object_type, object_id, status, trigger_time, sent_time) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(rule.id, objectType, objectId, status, new Date().toISOString(), sentTime ?? new Date().toISOString()).run()
}
