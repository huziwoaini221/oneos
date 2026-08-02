import { json, list, create } from '../_lib.js'

const ALLOWED = ['amount', 'category', 'date', 'note']

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  const month = url.searchParams.get('month')
  if (month) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM expenses WHERE substr(date, 1, 7) = ? ORDER BY date DESC'
    ).bind(month).all()
    return json(results)
  }
  return list(env.DB, 'expenses', 'date DESC')
}

export async function onRequestPost({ env, request }) {
  return create(env.DB, 'expenses', ALLOWED, request, { required: ['amount', 'category', 'date'] })
}
