import { getOne, update, remove } from '../../_lib.js'

const ALLOWED = ['title', 'description', 'priority', 'status', 'deadline', 'completed_at']

export async function onRequestGet({ env, params }) {
  return getOne(env.DB, 'tasks', params.id)
}

export async function onRequestPatch({ env, request, params }) {
  return update(env.DB, 'tasks', params.id, ALLOWED, request)
}

export async function onRequestDelete({ env, params }) {
  return remove(env.DB, 'tasks', params.id)
}
