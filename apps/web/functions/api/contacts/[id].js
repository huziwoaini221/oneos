import { getOne, update, remove } from '../_lib.js'

const ALLOWED = [
  'name', 'company', 'country', 'industry', 'phone', 'email',
  'wechat', 'telegram', 'level', 'last_contact', 'next_followup',
  'address', 'birthday', 'notes'
]

export async function onRequestGet({ env, params }) {
  return getOne(env.DB, 'contacts', params.id)
}

export async function onRequestPatch({ env, request, params }) {
  return update(env.DB, 'contacts', ALLOWED, request, params.id)
}

export async function onRequestDelete({ env, params }) {
  return remove(env.DB, 'contacts', params.id)
}
