import { json, readJson } from '../_lib.js'

const ALLOWED = ['timezone', 'telegram_chat_id', 'telegram_enabled', 'default_channel']

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare('SELECT * FROM settings WHERE id = 1').first()
  return json(row || {})
}

export async function onRequestPatch({ env, request }) {
  const body = await readJson(request)
  const data = {}
  for (const k of ALLOWED) {
    if (body[k] !== undefined) data[k] = body[k]
  }
  if (!Object.keys(data).length) return json({ error: 'no valid fields' }, 400)

  const sets = Object.keys(data).map((k) => `${k} = ?`).join(', ')
  await env.DB.prepare(`UPDATE settings SET ${sets} WHERE id = 1`).bind(...Object.values(data)).run()

  const row = await env.DB.prepare('SELECT * FROM settings WHERE id = 1').first()
  return json(row)
}

export async function onRequestPost({ env, request }) {
  const body = await readJson(request)
  const { chat_id, text } = body
  const token = env.TELEGRAM_BOT_TOKEN
  if (!token || !chat_id) return json({ error: 'missing token or chat_id' }, 400)

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Number(chat_id), text: text || 'LifeHub 测试消息' })
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    return json({ error: `telegram send failed: ${err}` }, 500)
  }
  return json({ ok: true })
}
