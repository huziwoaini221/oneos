import { useEffect, useState, useCallback } from 'react'
import { get, post, patch, del } from '../api.js'

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待办' },
  { value: 'doing', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'normal', label: '普通' },
  { value: 'high', label: '高' }
]

const STATUS_COLOR = {
  pending: '#eab308',
  doing: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#9ca3af'
}

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

function TaskBadge({ status, priority }) {
  return (
    <span className="badges">
      <span className="badge" style={{ background: STATUS_COLOR[status] || '#9ca3af' }}>
        {STATUS_OPTIONS.find(s => s.value === status)?.label || status}
      </span>
      {priority !== 'normal' && (
        <span className="badge priority">{priority}</span>
      )}
    </span>
  )
}

function TaskRow({ task, onUpdate, onDelete }) {
  const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed' && task.status !== 'cancelled'
  return (
    <tr className={overdue ? 'overdue' : ''}>
      <td>
        <input
          type="checkbox"
          checked={task.status === 'completed'}
          onChange={() => onUpdate(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' })}
        />
      </td>
      <td className="title">{task.title}</td>
      <td>
        <TaskBadge status={task.status} priority={task.priority} />
      </td>
      <td className={overdue ? 'deadline overdue' : 'deadline'}>
        {task.deadline ? (
          <>
            <div>{formatDate(task.deadline)}</div>
            <div className="relative">{formatRelative(task.deadline)}</div>
          </>
        ) : '—'}
      </td>
      <td>
        <button className="btn small" onClick={() => onUpdate(task.id, { status: 'doing' })} disabled={task.status === 'completed' || task.status === 'cancelled'}>
          {task.status === 'pending' ? '开始' : task.status === 'doing' ? '进行中' : '—'}
        </button>
        <button className="btn small danger" onClick={() => onDelete(task.id)} disabled={task.status === 'completed' || task.status === 'cancelled'}>
          删除
        </button>
      </td>
    </tr>
  )
}

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', status: 'pending', deadline: '' })

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const url = filterStatus ? `/api/tasks?status=${filterStatus}` : '/api/tasks'
      const data = await get(url)
      setTasks(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', description: '', priority: 'normal', status: 'pending', deadline: '' })
    setModalOpen(true)
  }

  const openEdit = (task) => {
    setEditing(task)
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      deadline: task.deadline ? task.deadline.slice(0, 16).replace(' ', 'T') : ''
    })
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const payload = { ...form, deadline: form.deadline || null }
    try {
      if (editing) {
        await patch(`/api/tasks/${editing.id}`, payload)
      } else {
        await post('/api/tasks', payload)
      }
      closeModal()
      fetchTasks()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleUpdate = async (id, patchData) => {
    try {
      await patch(`/api/tasks/${id}`, patchData)
      fetchTasks()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除该任务？')) return
    try {
      await del(`/api/tasks/${id}`)
      fetchTasks()
    } catch (e) {
      setError(e.message)
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false
    return true
  })

  const stats = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})

  return (
    <section>
      <header className="page-header">
        <h1>待办任务</h1>
        <button className="btn primary" onClick={openCreate}>+ 新建任务</button>
      </header>

      <div className="filters">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="stats">
          {STATUS_OPTIONS.filter(o => o.value).map(o => (
            <span key={o.value} className={`stat ${filterStatus === o.value ? 'active' : ''}`} onClick={() => setFilterStatus(filterStatus === o.value ? '' : o.value)}>
              {o.label}: {stats[o.value] || 0}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty">
          {tasks.length === 0 ? '暂无任务，点击“新建任务”开始' : '当前筛选下无任务'}
        </div>
      ) : (
        <table className="task-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>完成</th>
              <th>标题</th>
              <th>状态/优先级</th>
              <th>截止时间</th>
              <th style={{ width: 160 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(t => (
              <TaskRow key={t.id} task={t} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editing ? '编辑任务' : '新建任务'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>标题 *</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="任务标题" />
              </div>
              <div className="field">
                <label>描述</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="备注..." />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>优先级</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>状态</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>截止时间</label>
                <input type="datetime-local" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={closeModal}>取消</button>
                <button type="submit" className="btn primary">{editing ? '保存' : '创建'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}