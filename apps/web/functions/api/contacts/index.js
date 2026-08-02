import { json, list, create } from '../_lib.js'

const ALLOWED = [
  'name', 'company', 'country', 'industry', 'phone', 'email',
  'wechat', 'telegram', 'level', 'last_contact', 'next_followup',
  'address', 'birthday', 'notes'
]

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  const level = url.searchParams.get('level')
  const q = url.searchParams.get('q')
  if (level) {
    const { results } = await env.DB.prepare('SELECT * FROM contacts WHERE level = ? ORDER BY name ASC').bind(level).all()
    return json(results)
  }
  if (q) {
    const like = `%${q}%`
    const { results } = await env.DB.prepare(
      'SELECT * FROM contacts WHERE name LIKE ? OR phone LIKE ? OR wechat LIKE ? OR email LIKE ? OR company LIKE ? ORDER BY name ASC'
    ).bind(like, like, like, like, like).all()
    return json(results)
  }
  return list(env.DB, 'contacts', 'name ASC')
}

export async function onRequestPost({ env, request }) {
  return create(env.DB, 'contacts', ALLOWED, request, { required: ['name'] })
}
