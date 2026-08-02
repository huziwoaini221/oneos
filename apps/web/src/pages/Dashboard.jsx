import { useEffect, useState } from 'react'
import { get } from '../api.js'

function formatRelative(iso) {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (diff < 0) {
    const past = Math.abs(diff)
    const d = Math.floor(past / 86400000)
    const h = Math.floor((past % 86400000) / 3600000)
    return d > 0 ? `已过期 ${d}天${h}小时` : `已过期 ${h}小时`
  }
  if (days > 0) return `${days}天后`
  if (hours > 0) return `${hours}小时后`
  return '即将到期'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', {
    hour: '2-digit', minute: '2-digit'
  })
}

function StatCard({ label, value, sub, icon, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className={`stat-sub ${trend || ''}`}>{sub}</div>}
      </div>
    </div>
  )
}

function TaskItem({ task }) {
  const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed' && task.status !== 'cancelled'
  return (
    <div className={`task-item ${overdue ? 'overdue' : ''}`}>
      <input type="checkbox" checked={task.status === 'completed'} readOnly />
      <div className="task-info">
        <div className="task-title">{task.title}</div>
        {task.deadline && (
          <div className={`task-meta ${overdue ? 'overdue' : ''}`}>
            {formatDate(task.deadline)} · {formatRelative(task.deadline)}
          </div>
        )}
      </div>
    </div>
  )
}

function EventItem({ event }) {
  return (
    <div className="event-item">
      <div className="event-time">{formatTime(event.start_time)}</div>
      <div className="event-info">
        <div className="event-title">{event.title}</div>
        {event.location && <div className="event-location">📍 {event.location}</div>}
      </div>
    </div>
  )
}

function ContactItem({ contact }) {
  const days = contact.last_contact
    ? Math.floor((Date.now() - new Date(contact.last_contact).getTime()) / 86400000)
    : null
  return (
    <div className="contact-item">
      <div className="contact-name">{contact.name}</div>
      <div className="contact-meta">
        {contact.company && <span>{contact.company}</span>}
        {days !== null && <span className={days > 30 ? 'overdue' : ''}>{days} 天未联系</span>}
      </div>
    </div>
  )
}

function ReminderItem({ log }) {
  return (
    <div className="reminder-item">
      <span className="reminder-status">{log.status === 'sent' ? '✓' : log.status === 'failed' ? '✗' : '⏸'}</span>
      <span className="reminder-time">{formatTime(log.sent_time || log.trigger_time)}</span>
      <span className="reminder-rule">{log.rule_id}</span>
    </div>
  )
}

function ExpenseItem({ exp }) {
  return (
    <div className="expense-item">
      <span className="expense-category">{exp.category}</span>
      <span className="expense-amount">¥{exp.amount}</span>
      <span className="expense-time">{formatTime(exp.created_at)}</span>
    </div>
  )
}

function WeatherWidget() {
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    let cancelled = false
    get('/api/settings').then(async (s) => {
      const city = s?.weather_city
      if (!city) {
        if (!cancelled) setWeather({ city: null, temp: null, condition: '未设置天气城市', humidity: null, wind: null })
        return
      }
      const w = await get(`/api/weather?city=${encodeURIComponent(city)}`).catch(() => null)
      if (!cancelled) setWeather(w || { city, temp: null, condition: '天气获取失败', humidity: null, wind: null })
    }).catch(() => {
      if (!cancelled) setWeather({ city: null, temp: null, condition: '天气获取失败', humidity: null, wind: null })
    })
    return () => { cancelled = true }
  }, [])
  if (!weather) return <div className="stat-card loading">加载天气...</div>
  return (
    <div className="stat-card weather">
      <div className="weather-main">
        {weather.temp != null ? <span className="weather-temp">{weather.temp}°C</span> : null}
        <span className="weather-condition">{weather.condition}</span>
      </div>
      <div className="weather-details">
        {weather.humidity != null ? <span>湿度 {weather.humidity}%</span> : null}
        {weather.wind ? <span>{weather.wind}</span> : null}
        {weather.city ? <span>{weather.city}</span> : null}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [contacts, setContacts] = useState([])
  const [reminders, setReminders] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const monthPrefix = today.slice(0, 7)

    Promise.all([
      get('/api/tasks?status=pending').catch(() => []),
      get('/api/tasks?status=doing').catch(() => []),
      get(`/api/events?from=${today}&to=${tomorrow}`).catch(() => []),
      get('/api/contacts').catch(() => []),
      get('/api/reminders?scope=logs').catch(() => []),
      get(`/api/finance?month=${monthPrefix}`).catch(() => [])
    ]).then(([pending, doing, evts, cts, rms, exps]) => {
      setTasks([...(pending || []), ...(doing || [])].slice(0, 5))
      setEvents((evts || []).slice(0, 5))
      setContacts((cts || []).filter(c => c.last_contact).sort((a, b) =>
        new Date(a.last_contact) - new Date(b.last_contact)
      ).slice(0, 5))
      setReminders((rms || []).slice(0, 5))
      setExpenses((exps || []).slice(0, 5))
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="loading">加载中...</div>

  const todayExpenses = expenses.filter(e => e.date === new Date().toISOString().slice(0, 10))
  const todayTotal = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <section>
      <h1>Dashboard</h1>
      {error && <div className="error">{error}</div>}

      <div className="dashboard-grid">
        <WeatherWidget />

        <StatCard label="今日任务" value={tasks.length} sub={`${tasks.filter(t => t.status === 'doing').length} 进行中`} icon="📋" />
        <StatCard label="今日日程" value={events.length} sub={events.length ? events.map(e => formatTime(e.start_time)).join(', ') : '无'} icon="📅" />
        <StatCard label="待跟进" value={contacts.length} sub={contacts[0] ? `${contacts[0].name} (${Math.floor((Date.now() - new Date(contacts[0].last_contact).getTime())/86400000)} 天)` : '无'} icon="👥" />
        <StatCard label="今日消费" value={todayTotal > 0 ? `¥${todayTotal}` : '—'} sub={todayExpenses.length ? `${todayExpenses.length} 笔` : '无记录'} icon="💰" />
        <StatCard label="最近提醒" value={reminders.length} sub={reminders[0] ? `${reminders[0].status === 'sent' ? '已发送' : reminders[0].status}` : '无'} icon="🔔" />
      </div>

      <div className="dashboard-sections">
        <div className="section">
          <header className="section-header">
            <h2>今日任务</h2>
            <a href="/tasks">查看全部 →</a>
          </header>
          {tasks.length ? tasks.map(t => <TaskItem key={t.id} task={t} />) : <p className="empty">暂无待办任务</p>}
        </div>

        <div className="section">
          <header className="section-header">
            <h2>今日日程</h2>
            <a href="/calendar">查看全部 →</a>
          </header>
          {events.length ? events.map(e => <EventItem key={e.id} event={e} />) : <p className="empty">今天没有日程</p>}
        </div>

        <div className="section">
          <header className="section-header">
            <h2>待跟进联系人</h2>
            <a href="/contacts">查看全部 →</a>
          </header>
          {contacts.length ? contacts.map(c => <ContactItem key={c.id} contact={c} />) : <p className="empty">暂无待跟进</p>}
        </div>

        <div className="section">
          <header className="section-header">
            <h2>最近提醒</h2>
            <a href="/reminders">查看全部 →</a>
          </header>
          {reminders.length ? reminders.map((r, i) => <ReminderItem key={i} log={r} />) : <p className="empty">暂无提醒记录</p>}
        </div>

        <div className="section">
          <header className="section-header">
            <h2>今日消费</h2>
            <a href="/finance">查看全部 →</a>
          </header>
          {todayExpenses.length ? todayExpenses.map(e => <ExpenseItem key={e.id} exp={e} />) : <p className="empty">今天暂无消费记录</p>}
        </div>
      </div>
    </section>
  )
}