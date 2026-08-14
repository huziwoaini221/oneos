import { runReminderEngine } from '@lifehub/reminder-engine'

const FIFTEEN_MIN = 15 * 60 * 1000

// 每 15 分钟整点边界，严格取下一个
function nextBoundary(now = new Date()) {
  const rem = now.getTime() % FIFTEEN_MIN
  return now.getTime() + FIFTEEN_MIN - rem
}

// Durable Object 自续链：alarm 触发跑引擎并续上下一跳，
// 不依赖 CF cron 触发器（免费计划下 cron 不可靠/失效）。
export class ReminderScheduler {
  constructor(state, env) {
    this.state = state
    this.env = env
  }

  async fetch(request) {
    const next = await this.arm()
    return new Response(JSON.stringify({ ok: true, nextAlarm: new Date(next).toISOString() }))
  }

  // 确保下一条 alarm 已设置（只在需要时覆盖，避免打乱链条）
  async arm() {
    const next = nextBoundary()
    const existing = await this.state.storage.getAlarm()
    if (existing === null || existing > next + 5000) {
      await this.state.storage.setAlarm(next)
    }
    return next
  }

  async alarm() {
    await this.arm()
    try {
      const now = new Date().toISOString()
      await this.env.DB.prepare(
        'INSERT INTO reminder_logs (rule_id, object_type, object_id, status, trigger_time, sent_time) VALUES (0, ?, ?, ?, ?, ?)'
      ).bind('alarm', 'heartbeat', 'tick', now, now).run()
      await runReminderEngine(this.env)
    } catch (err) {
      console.error('[scheduler] engine failed:', err)
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/run' && request.method === 'POST') {
      const secret = env.CRON_SECRET
      if (secret && request.headers.get('X-Cron-Secret') !== secret) {
        return new Response('Unauthorized', { status: 401 })
      }
      try {
        await runReminderEngine(env)
      } catch (err) {
        return new Response(`ERR: ${err.message}`, { status: 500 })
      }
      await ensureArmed(env)
      return new Response('OK')
    }
    return new Response('not found', { status: 404 })
  },

  async scheduled(controller, env, ctx) {
    try {
      const now = new Date().toISOString()
      await env.DB.prepare(
        'INSERT INTO reminder_logs (rule_id, object_type, object_id, status, trigger_time, sent_time) VALUES (0, ?, ?, ?, ?, ?)'
      ).bind('cron', 'heartbeat', 'tick', now, now).run()
      await runReminderEngine(env)
    } catch (err) {
      console.error('[cron] engine failed:', err)
    }
    await ensureArmed(env)
  }
}

async function ensureArmed(env) {
  if (!env.REMINDER_SCHEDULER) return
  try {
    const id = env.REMINDER_SCHEDULER.idFromName('chain')
    const stub = env.REMINDER_SCHEDULER.get(id)
    await stub.fetch('https://internal/arm')
  } catch (err) {
    console.error('[scheduler] arming failed:', err)
  }
}
