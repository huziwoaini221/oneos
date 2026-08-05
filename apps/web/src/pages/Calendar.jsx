import { useEffect, useState, useCallback, useMemo } from 'react'
import { get, post, patch, del } from '../api.js'

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', {
    hour: '2-digit', minute: '2-digit'
  })
}

function EventDot({ event }) {
  return (
    <div className="event-dot" style={{ background: event.color || '#3b82f6' }}
         title={`${event.title} ${formatTime(event.start_time)}`} />
  )
}

function DayCell({ date, events, today, selected, onClick, inCurrentMonth }) {
  const isToday = formatDateKey(date) === formatDateKey(today)
  const dayEvents = events.filter(e => formatDateKey(new Date(e.start_time)) === formatDateKey(date))
  return (
    <button
      type="button"
      className={`day-cell ${isToday ? 'today' : ''} ${selected ? 'selected' : ''} ${!inCurrentMonth ? 'other-month' : ''}`}
      onClick={() => onClick(date)}
    >
      <span className="day-number">{date.getDate()}</span>
      <div className="day-events">
        {dayEvents.slice(0, 3).map(e => <EventDot key={e.id} event={e} />)}
        {dayEvents.length > 3 && <span className="more-events">+{dayEvents.length - 3}</span>}
      </div>
    </button>
  )
}

function EventModal({ event, events, onClose, onSave, onDelete }) {
  const editing = !!event?.id
  const [form, setForm] = useState({
    title: event?.title || '',
    start_time: event?.start_time ? event.start_time.slice(0, 16).replace(' ', 'T') : '',
    end_time: event?.end_time ? event.end_time.slice(0, 16).replace(' ', 'T') : '',
    location: event?.location || '',
    notes: event?.notes || '',
    color: event?.color || '#3b82f6'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const payload = {
      title: form.title,
      start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      location: form.location || null,
      notes: form.notes || null,
      color: form.color
    }
    try {
      if (editing) await patch(`/api/events/${event.id}`, payload)
      else await post('/api/events', payload)
      onClose()
      onSave()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async () => {
    if (!editing || !window.confirm('确定删除该日程？')) return
    try {
      await del(`/api/events/${event.id}`)
      onClose()
      onSave()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{editing ? '编辑日程' : '新建日程'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>标题 *</label>
            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="日程标题" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>开始时间 *</label>
              <input type="datetime-local" required value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="field">
              <label>结束时间</label>
              <input type="datetime-local" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>地点</label>
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="地点" />
          </div>
          <div className="field">
            <label>备注</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="备注" />
          </div>
          <div className="field">
            <label>颜色</label>
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>取消</button>
            {editing && <button type="button" className="btn danger" onClick={handleDelete}>删除</button>}
            <button type="submit" className="btn primary">{editing ? '保存' : '创建'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [modalEvent, setModalEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const today = new Date()

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      const data = await get(`/api/events?from=${formatDateKey(start)}&to=${formatDateKey(end)}`)
      setEvents(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay()
    const days = []
    for (let i = 0; i < startDay; i++) {
      const d = new Date(year, month, -startDay + 1 + i)
      days.push({ date: d, inCurrentMonth: false })
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), inCurrentMonth: true })
    }
    const totalCells = Math.ceil((startDay + lastDay.getDate()) / 7) * 7
    for (let i = days.length; i < totalCells; i++) {
      const d = new Date(year, month + 1, i - lastDay.getDate() + 1)
      days.push({ date: d, inCurrentMonth: false })
    }
    return days
  }, [currentMonth])

  const handleDayClick = (date) => {
    setSelectedDate(date)
    setModalEvent(null)
  }

  const handleEventClick = (e, event) => {
    e.stopPropagation()
    setModalEvent(event)
  }

  const closeModal = () => { setModalEvent(null); setSelectedDate(null) }

  const handleSave = () => {
    closeModal()
    fetchEvents()
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>日历</h1>
          <p className="page-subtitle">{currentMonth.toLocaleString('zh-CN', { year: 'numeric', month: 'long' })}</p>
        </div>
        <div className="header-actions">
          <button className="btn secondary" onClick={() => setCurrentMonth(new Date())}>今天</button>
          <button className="btn secondary" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>← 上月</button>
          <button className="btn secondary" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>下月 →</button>
          <button className="btn primary" onClick={() => { setModalEvent({}); }}>+ 新建</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="calendar-container">
        <div className="calendar-grid">
          {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
            <div key={i} className="calendar-weekday">{d}</div>
          ))}
          {daysInMonth.map((day, i) => (
            <DayCell
              key={i}
              date={day.date}
              events={events}
              today={today}
              selected={selectedDate && formatDateKey(day.date) === formatDateKey(selectedDate)}
              onClick={handleDayClick}
              inCurrentMonth={day.inCurrentMonth}
            />
          ))}
        </div>

        {selectedDate && !modalEvent && (
          <div className="day-detail">
            <h3>{selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</h3>
            {events.filter(e => formatDateKey(new Date(e.start_time)) === formatDateKey(selectedDate)).map(ev => (
              <div key={ev.id} className="day-event" onClick={() => handleEventClick(new MouseEvent('click'), ev)}>
                <span className="event-color" style={{ background: ev.color }}></span>
                <span>{formatTime(ev.start_time)} {ev.title}</span>
              </div>
            ))}
            {events.filter(e => formatDateKey(new Date(e.start_time)) === formatDateKey(selectedDate)).length === 0 && (
              <p className="empty">这一天没有日程</p>
            )}
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setModalEvent({})}>+ 新建日程</button>
          </div>
        )}
      </div>

      {modalEvent && (
        <EventModal
          event={modalEvent}
          events={events}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={() => {}}
        />
      )}
    </section>
  )
}