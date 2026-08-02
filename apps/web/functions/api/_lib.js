export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export async function list(db, table, orderBy = 'id DESC') {
  const { results } = await db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all()
  return json(results)
}

export async function getOne(db, table, id) {
  const result = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first()
  if (!result) return json({ error: 'Not found' }, 404)
  return json(result)
}

export async function create(db, table, allowedFields, request, options = {}) {
  const body = await readJson(request)
  const { required = [] } = options
  for (const field of required) {
    if (!body[field]) return json({ error: `Missing ${field}` }, 400)
  }
  const fields = []
  const values = []
  const placeholders = []
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      fields.push(key)
      values.push(body[key])
      placeholders.push('?')
    }
  }
  const stmt = db.prepare(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`)
  const info = await stmt.bind(...values).run()
  return json({ id: info.meta.last_row_id }, 201)
}

export async function update(db, table, allowedFields, request, id) {
  const body = await readJson(request)
  const fields = []
  const values = []
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`)
      values.push(body[key])
    }
  }
  if (!fields.length) return json({ error: 'No fields to update' }, 400)
  values.push(id)
  const stmt = db.prepare(`UPDATE ${table} SET ${fields.join(', ')} WHERE id = ?`)
  await stmt.bind(...values).run()
  return json({ success: true })
}

export async function remove(db, table, id) {
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run()
  return json({ success: true })
}