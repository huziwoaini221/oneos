import { runReminderEngine } from '@lifehub/reminder-engine'

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
        return new Response('OK')
      } catch (err) {
        return new Response(`ERR: ${err.message}`, { status: 500 })
      }
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
  }
}