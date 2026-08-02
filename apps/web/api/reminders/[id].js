import { json, getOne, remove, readJson } from '../../_lib.js'
import { nextFireAt } from '@lifehub/reminder-engine/scheduler'

const ALLOWED = ['name', 'type', 'source', 'condition_json', 'schedule', 'channel', 'enabled', 'next_fire_at']

export async function onRequestGet({ env, params }) {
  return getOne(env.DB, 'reminder_rules', params.id)
}

export async function onRequestPatch({ env, request, params }) {
  const body = await readJson(request)
  const data = {}
  for (const k of ALLOWED) {
    if (body[k] !== undefined) data[k] = body[k]
  }
  if (!Object.keys(data).length) return json({ error: 'no valid fields' }, 400)

  // 修改 time 型规则的 schedule 时重算 next_fire_at
  if (data.type === 'time' && data.schedule) {
    const settings = await env.DB.prepare('SELECT * FROM settings WHERE id = 1').first()
    const next = nextFireAt(new Date(), settings?.timezone || 'Asia/Shanghai', data.schedule)
    if (!next) return json({ error: `unsupported schedule: ${data.schedule}` }, 400)
    data.next_fire_at = next.toISOString()
  }

  const sets = Object.keys(data).map((k) => `${k} = ?`).join(', ')
  await env.DB.prepare(`UPDATE reminder_rules SET ${sets} WHERE id = ?`).bind(...Object.values(data), params.id).run()
  return getOne(env.DB, 'reminder_rules', params.id)
}

export async function onRequestDelete({ env, params }) {
  return remove(env.DB, 'reminder_rules', params.id)
}
