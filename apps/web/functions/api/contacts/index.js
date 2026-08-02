import { json, list, create } from '../_lib.js'

const ALLOWED = [
  'name', 'company', 'country', 'industry', 'phone', 'email',
  'wechat', 'telegram', 'level', 'last_contact', 'next_followup', 'notes'
]

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  const level = url.searchParams.get('level')
  if (level) {
    const { results } = await env.DB.prepare('SELECT * FROM contacts WHERE level = ? ORDER BY name ASC').bind(level).all()
    return json(results)
  }
  return list(env.DB, 'contacts', 'name ASC')
}

export async function onRequestPost({ env, request }) {
  return create(env.DB, 'contacts', ALLOWED, request, { required: ['name'] })
}
