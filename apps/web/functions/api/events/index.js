import { json, list, create } from '../../_lib.js'

const ALLOWED = ['title', 'start_time', 'end_time', 'location', 'notes']

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (from || to) {
    let sql = 'SELECT * FROM events WHERE 1=1'
    const args = []
    if (from) {
      sql += ' AND start_time >= ?'
      args.push(from)
    }
    if (to) {
      sql += ' AND start_time <= ?'
      args.push(to)
    }
    const { results } = await env.DB.prepare(`${sql} ORDER BY start_time ASC`).bind(...args).all()
    return json(results)
  }
  return list(env.DB, 'events', 'start_time ASC')
}

export async function onRequestPost({ env, request }) {
  return create(env.DB, 'events', ALLOWED, request, { required: ['title'] })
}
