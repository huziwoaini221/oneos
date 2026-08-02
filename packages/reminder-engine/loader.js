// 按 rule.source 从 D1 加载候选数据。
// finance 返回按分类聚合的本月支出（item.id = 分类名，用于去重键）。

import { localParts } from './scheduler.js'

export async function loadCandidates(db, rule, now, timezone) {
  switch (rule.source) {
    case 'tasks': {
      const { results } = await db.prepare(
        "SELECT * FROM tasks WHERE status NOT IN ('completed', 'cancelled') AND deadline IS NOT NULL"
      ).all()
      return results
    }
    case 'events': {
      // 回看 2 小时，避免 cron 边界漏发
      const horizon = new Date(now.getTime() - 2 * 3600 * 1000).toISOString()
      const { results } = await db.prepare('SELECT * FROM events WHERE start_time >= ?').bind(horizon).all()
      return results
    }
    case 'contacts': {
      const { results } = await db.prepare('SELECT * FROM contacts WHERE last_contact IS NOT NULL').all()
      return results
    }
    case 'birthdays': {
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const { results } = await db.prepare(
        "SELECT * FROM contacts WHERE birthday IS NOT NULL AND substr(birthday, 6, 5) = ?"
      ).bind(`${month}-${day}`).all()
      return results
    }
    case 'finance': {
      const p = localParts(now, timezone)
      const prefix = `${p.year}-${String(p.month).padStart(2, '0')}`
      const { results } = await db.prepare(
        'SELECT category AS id, category, SUM(amount) AS total FROM expenses WHERE substr(date, 1, 7) = ? GROUP BY category'
      ).bind(prefix).all()
      return results
    }
    default:
      return []
  }
}
