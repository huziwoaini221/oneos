import { json, list, create } from '../../_lib.js'

const ALLOWED = ['title', 'description', 'priority', 'status', 'deadline', 'completed_at']

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  if (status) {
    const { results } = await env.DB.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY deadline ASC').bind(status).all()
    return json(results)
  }
  return list(env.DB, 'tasks', 'status ASC, deadline ASC')
}

export async function onRequestPost({ env, request }) {
  return create(env.DB, 'tasks', ALLOWED, request, { required: ['title'] })
}
