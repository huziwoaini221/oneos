import { runReminderEngine } from '@lifehub/reminder-engine'

export default {
  async scheduled(controller, env, ctx) {
    const cronUrl = env.VERCEL_CRON_URL
    if (!cronUrl) {
      console.error('[cron] VERCEL_CRON_URL not configured')
      return
    }
    try {
      const res = await fetch(cronUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.CRON_SECRET}` }
      })
      if (!res.ok) {
        console.error(`[cron] cron endpoint failed: ${res.status}`)
      }
    } catch (e) {
      console.error('[cron] cron endpoint call failed, fallback to local:', e)
      await runReminderEngine(env).catch(err => console.error('[cron] engine failed:', err))
    }
  }
}