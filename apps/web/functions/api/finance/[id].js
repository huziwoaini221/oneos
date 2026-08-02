import { getOne, remove } from '../../_lib.js'

export async function onRequestGet({ env, params }) {
  return getOne(env.DB, 'expenses', params.id)
}

export async function onRequestDelete({ env, params }) {
  return remove(env.DB, 'expenses', params.id)
}
