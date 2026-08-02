// 条件求值器。
// 支持：before / days_since / deadline_before / over_budget。

export function evaluate(rule, item, now) {
  const cond = parseCondition(rule)
  const t = now.getTime()

  switch (cond.type) {
    case 'before': {
      // 0 <= 开始前分钟数 <= minutes，防止事件开始后仍重复匹配
      if (cond.minutes == null || !item.start_time) return false
      const diffMin = (new Date(item.start_time).getTime() - t) / 60000
      return diffMin >= 0 && diffMin <= cond.minutes
    }
    case 'days_since': {
      const field = cond.field || 'last_contact'
      if (!item[field]) return false
      const days = Math.floor((t - new Date(item[field]).getTime()) / 86400000)
      const operator = cond.operator || 'days_gt'
      if (operator === 'days_gt') return days > cond.value
      if (operator === 'days_gte') return days >= cond.value
      return false
    }
    case 'birthday': {
      return !!item.birthday
    }
    case 'deadline_before': {
      if (!item.deadline) return false
      if (item.status === 'completed' || item.status === 'cancelled') return false
      const diffHours = (new Date(item.deadline).getTime() - t) / 3600000
      return diffHours >= 0 && diffHours <= (cond.hours ?? 24)
    }
    case 'over_budget': {
      return typeof item.total === 'number' && item.total > cond.amount
    }
    default:
      return false
  }
}

function parseCondition(rule) {
  try {
    return JSON.parse(rule.condition_json || '{}')
  } catch {
    return {}
  }
}
