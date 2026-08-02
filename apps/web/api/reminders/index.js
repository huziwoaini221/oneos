import { json, readJson } from '../../_lib.js'
import { nextFireAt } from '@lifehub/reminder-engine/scheduler'

const ALLOWED = ['name', 'type', 'source', 'condition_json', 'schedule', 'channel', 'enabled', 'next_fire_at']

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  if (url.searchParams.get('scope') === 'logs') {
    const { results } = await env.DB.prepare('SELECT * FROM reminder_logs ORDER BY id DESC LIMIT 50').all()
    return json(results)
  }
  const { results } = await env.DB.prepare('SELECT * FROM reminder_rules ORDER BY id ASC').all()
  return json(results)
}

export async function onRequestPost({ env, request }) {
  const body = await readJson(request)
  if (!body.name || !body.type) return json({ error: 'missing fields: name, type' }, 400)
  if (body.type !== 'time' && body.type !== 'data') {
    return json({ error: 'type must be time or data' }, 400)
  }

  const data = { name: body.name, type: body.type, channel: body.channel ?? 'telegram', enabled: body.enabled ?? 1 }
  for (const k of ['source', 'condition_json', 'schedule', 'next_fire_at']) {
    if (body[k] !== undefined) data[k] = body[k]
  }

  if (body.type === 'time') {
    if (!body.schedule) return json({ error: 'schedule required for time rule' }, 400)
    const settings = await env.DB.prepare('SELECT * FROM settings WHERE id = 1').first()
    const next = nextFireAt(new Date(), settings?.timezone || 'Asia/Shanghai', body.schedule)
    if (!next) return json({ error: `unsupported schedule: ${body.schedule}` }, 400)
    data.next_fire_at = next.toISOString()
  }

  const keys = Object.keys(data)
  const placeholders = keys.map(() => '?').join(', ')
  const res = await env.DB
    .prepare(`INSERT INTO reminder_rules (${keys.join(', ')}) VALUES (${placeholders})`)
    .bind(...keys.map((k) => data[k]))
    .run()

  const { results } = await env.DB.prepare('SELECT * FROM reminder_rules WHERE id = ?').bind(res.meta.last_row_id).all()
  return json(results[0], 201)
}
