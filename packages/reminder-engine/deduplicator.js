// 去重器：按 (rule_id, object_type, object_id) 查最近发送时间。
// now - last_sent < notify_interval（秒）时禁止再次发送。

export async function canNotify(db, rule, objectType, objectId, intervalSec) {
  const row = await db.prepare(
    'SELECT MAX(sent_time) AS last_sent FROM reminder_logs WHERE rule_id = ? AND object_type = ? AND object_id = ?'
  ).bind(rule.id, objectType, String(objectId)).first()
  if (!row || !row.last_sent) return true
  const last = new Date(row.last_sent).getTime()
  return Date.now() - last >= intervalSec * 1000
}
