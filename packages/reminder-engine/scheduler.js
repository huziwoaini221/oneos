// 微型 cron 解析器 + next_fire_at 计算。
// 零依赖，只用 Intl.DateTimeFormat 做时区换算。
// 支持子集：每天 HH:MM / 每周某天 HH:MM（dow 0-6，0=周日）/ 每月某号 HH:MM。
// 不支持的表达式：返回 null（调用方跳过规则，不崩溃）。

const formatters = new Map()

function getFormatter(timeZone) {
  let fmt = formatters.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    })
    formatters.set(timeZone, fmt)
  }
  return fmt
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

// date 在指定时区的本地钟表时间
export function localParts(date, timeZone) {
  const fmt = getFormatter(timeZone)
  const map = {}
  for (const part of fmt.formatToParts(date)) map[part.type] = part.value
  let hour = parseInt(map.hour, 10)
  if (hour === 24) hour = 0 // Intl 午夜可能输出 24
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour,
    minute: parseInt(map.minute, 10),
    weekday: WEEKDAYS[map.weekday]
  }
}

// 解析 timeZoneName (如 'GMT+8', 'GMT-05:00') 为毫秒偏移
function parseOffset(tzName) {
  const m = String(tzName).match(/GMT([+-])(\d+):?(\d+)?/)
  if (!m) return 0
  const sign = m[1] === '+' ? 1 : -1
  const hours = parseInt(m[2], 10)
  const minutes = parseInt(m[3] || '0', 10)
  return sign * (hours * 3600 + minutes * 60) * 1000
}

// 获取指定 UTC 时间在目标时区的偏移毫秒数
function getOffsetMs(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset', hour12: false })
  const parts = fmt.formatToParts(date)
  const tzPart = parts.find(p => p.type === 'timeZoneName')
  return tzPart ? parseOffset(tzPart.value) : 0
}

// 本地钟表时间 -> UTC 时间戳
// 先在目标本地日期的 UTC 中午查询该日期的时区偏移（全天偏移通常恒定，DST 切换点除外），
// 再用 offset = local - utc 反推 utc = local - offset。
export function localWallToUtc(target, timeZone) {
  // 以目标本地日期的 UTC 中午为参考点查询偏移（避开 DST 通常在凌晨 2 点的切换点）
  const refUtc = new Date(Date.UTC(target.year, target.month - 1, target.day, 12, 0))
  const offsetMs = getOffsetMs(refUtc, timeZone)
  const targetLocalMs = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  return new Date(targetLocalMs - offsetMs)
}

// 解析 cron 五段式，返回 { minute, hour, dayOfMonth, dayOfWeek } 或 null
export function parseCron(expr) {
  const parts = String(expr || '').trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minute, hour, dom, month, dow] = parts
  if (month !== '*') return null // 不支持月份指定
  const m = minute === '*' ? null : parseInt(minute, 10)
  const h = hour === '*' ? null : parseInt(hour, 10)
  const d = dom === '*' ? null : parseInt(dom, 10)
  const w = dow === '*' ? null : parseInt(dow, 10)
  if (m === null || h === null) return null
  if (m < 0 || m > 59 || h < 0 || h > 23) return null
  if (d !== null && (d < 1 || d > 31)) return null
  if (w !== null && (w < 0 || w > 6)) return null
  if (d !== null && w !== null) return null // 不支持 dom+dow 组合
  return { minute: m, hour: h, dayOfMonth: d, dayOfWeek: w }
}

// 由 schedule 推导 notify_interval（秒），作为去重的兜底窗口
export function deriveNotifyInterval(expr) {
  const cron = parseCron(expr)
  if (!cron) return 86400
  if (cron.dayOfMonth !== null) return 2678400 // 每月 ~31 天
  if (cron.dayOfWeek !== null) return 604800 // 每周
  return 82800 // 每天 23h：容忍 ≤1h 调度偏移，晨报稳定按点发送
}

// 计算严格晚于 fromDate 的下一次本地触发点（UTC Date），不支持则返回 null
export function nextFireAt(fromDate, timeZone, expr) {
  const cron = parseCron(expr)
  if (!cron) return null
  const from = new Date(fromDate)
  const nowParts = localParts(from, timeZone)
  const base = { hour: cron.hour, minute: cron.minute }

  const candidates = []
  if (cron.dayOfWeek === null && cron.dayOfMonth === null) {
    candidates.push({ ...base, year: nowParts.year, month: nowParts.month, day: nowParts.day })
    candidates.push({ ...base, year: nowParts.year, month: nowParts.month, day: nowParts.day + 1 })
  } else if (cron.dayOfWeek !== null) {
    for (let add = 0; add <= 7; add++) {
      const probe = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day) + add * 86400000)
      const p = localParts(probe, timeZone)
      if (p.weekday === cron.dayOfWeek) {
        candidates.push({ ...base, year: p.year, month: p.month, day: p.day })
      }
    }
  } else {
    for (let add = 0; add <= 62; add++) {
      const probe = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day) + add * 86400000)
      const p = localParts(probe, timeZone)
      if (p.day === cron.dayOfMonth) {
        candidates.push({ ...base, year: p.year, month: p.month, day: p.day })
      }
    }
  }

  for (const c of candidates) {
    const t = localWallToUtc(c, timeZone)
    if (t.getTime() > from.getTime()) return t
  }
  return null
}
