import { runReminderEngine } from '@lifehub/reminder-engine'

export default {
  async scheduled(controller, env, ctx) {
    // 优先调用 Vercel API，失败回退到本地引擎
    try {
      await fetch("https://<your-vercel-domain>/api/cron/reminder", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.CRON_SECRET}` }
      })
    } catch (e) {
      console.error('[cron] Vercel call failed, fallback to local:', e)
      await runReminderEngine(env).catch(err => console.error('[cron] engine failed:', err))
    }
  }
}