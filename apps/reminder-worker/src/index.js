import { runReminderEngine } from '@lifehub/reminder-engine'

export default {
  async scheduled(controller, env, ctx) {
    try {
      await runReminderEngine(env)
    } catch (err) {
      console.error('[cron] engine failed:', err)
    }
  }
}