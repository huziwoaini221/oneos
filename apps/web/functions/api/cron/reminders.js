import { runReminderEngine } from '@lifehub/reminder-engine'

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  await runReminderEngine(env)
  return new Response('OK')
}