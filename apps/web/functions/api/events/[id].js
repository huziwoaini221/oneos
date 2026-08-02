import { getOne, update, remove } from '../_lib.js'

const ALLOWED = ['title', 'start_time', 'end_time', 'location', 'notes']

export async function onRequestGet({ env, params }) {
  return getOne(env.DB, 'events', params.id)
}

export async function onRequestPatch({ env, request, params }) {
  return update(env.DB, 'events', params.id, ALLOWED, request)
}

export async function onRequestDelete({ env, params }) {
  return remove(env.DB, 'events', params.id)
}
