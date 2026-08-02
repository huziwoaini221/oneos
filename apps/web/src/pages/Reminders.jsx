import { useEffect, useState, useCallback } from 'react'
import { get, post, patch, del } from '../api.js'
import { nextFireAt } from '@lifehub/reminder-engine/scheduler'

const TYPE_OPTIONS = [
  { value: 'time', label: '时间型' },
  { value: 'data', label: '数据型' }
]

const SOURCE_OPTIONS = [
  { value: 'tasks', label: '任务' },
  { value: 'events', label: '日程' },
  { value: 'contacts', label: '联系人' },
  { value: 'finance', label: '财务' }
]

const CONDITION_TEMPLATES = {
  tasks: [
    { label: '截止前 24 小时', value: { type: 'deadline_before', hours: 24 } },
    { label: '截止前 1 小时', value: { type: 'deadline_before', hours: 1 } }
  ],
  events: [
    { label: '开始前 30 分钟', value: { type: 'before', minutes: 30 } },
    { label: '开始前 1 小时', value: { type: 'before', minutes: 60 } }
  ],
  contacts: [
    { label: '30 天未联系', value: { type: 'days_since', field: 'last_contact', value: 30, notify_interval: 2592000 } },
    { label: '7 天未联系', value: { type: 'days_since', field: 'last_contact', value: 7, notify_interval: 604800 } }
  ],
  finance: [
    { label: '月支出超预算', value: { type: 'over_budget', category: 'food', amount: 2000, period: 'monthly', notify_interval: 2592000 } }
  ]
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatRelative(iso) {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (diff < 0) return '已过期'
  if (days > 0) return `${days}天后`
  if (hours > 0) return `${hours}小时后`
  return '即将触发'
}

function RuleRow({ rule, onToggle, onEdit, onDelete, settings }) {
  const nextFire = rule.next_fire_at ? formatDate(rule.next_fire_at) : '—'
  const isTime = rule.type === 'time'
  const schedule = isTime ? rule.schedule : '—'
  const source = !isTime ? rule.source : '—'
  return (
    <tr>
      <td>{rule.name}</td>
      <td><span className="badge">{rule.type === 'time' ? '时间型' : '数据型'}</span></td>
      <td>{schedule}</td>
      <td>{source}</td>
      <td>{nextFire}</td>
      <td>
        <label className="switch">
          <input type="checkbox" checked={rule.enabled} onChange={e => onToggle(rule.id, e.target.checked)} />
          <span className="slider"></span>
        </label>
      </td>
      <td>
        <button className="btn small secondary" onClick={() => onEdit(rule)}>编辑</button>
        <button className="btn small danger" onClick={() => { if (window.confirm('确定删除？')) onDelete(rule.id) }}>删除</button>
      </td>
    </tr>
  )
}

function RuleModal({ rule, settings, onClose, onSave }) {
  const editing = !!rule
  const isTime = rule?.type === 'time'
  const [form, setForm] = useState({
    name: rule?.name || '',
    type: rule?.type || 'time',
    source: rule?.source || '',
    schedule: rule?.schedule || '0 8 * * *',
    condition_json: rule?.condition_json || '',
    channel: rule?.channel || 'telegram',
    enabled: rule?.enabled !== 0
  })

  useEffect(() => {
    if (form.type === 'time' && !form.schedule) {
      setForm(f => ({ ...f, schedule: '0 8 * * *' }))
    }
  }, [form.type])

  const templates = form.source ? CONDITION_TEMPLATES[form.source] || [] : []

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { alert('请填写规则名称'); return }
    if (form.type === 'time' && !form.schedule) { alert('时间型规则需填写 schedule'); return }
    if (form.type === 'data' && !form.source) { alert('数据型规则需选择 source'); return }

    const payload = { ...form }
    if (form.type === 'time') {
      delete payload.source
      delete payload.condition_json
      try {
        const next = nextFireAt(new Date(), form.timezone || 'Asia/Shanghai', form.schedule)
        if (!next) { alert('不支持的 schedule 表达式'); return }
        payload.next_fire_at = next.toISOString()
      } catch (e) { alert('schedule 计算失败: ' + e.message); return }
    } else {
      delete payload.schedule
      delete payload.next_fire_at
      if (form.condition_json) {
        try { JSON.parse(form.condition_json) } catch { alert('condition_json 格式错误'); return }
      }
    }
    try { await onSave(payload) } catch (e) { alert(e.message) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <h3>{editing ? '编辑规则' : '新建规则'}</h3>
        <form onSubmit={handleSubmit}>
<div className="field">
        <label>规则名称 *</label>
        <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：每日晨报" />
      </div>
      <div className="field-row">
        <div className="field">
          <label>类型 *</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, source: '', schedule: '0 8 * * *', condition_json: '' }))}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>渠道</label>
          <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
            <option value="telegram">Telegram</option>
          </select>
        </div>
      </div>

      {form.type === 'time' ? (
        <div className="field">
          <label>Cron 表达式 * (每天/每周/每月 HH:MM，UTC)</label>
          <input value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} placeholder="0 8 * * * = 每天 08:00 UTC" />
          <div className="hint">示例：每天 08:00 → 0 8 * * * | 每周一 09:00 → 0 9 * * 1 | 每月 1 号 10:00 → 0 10 1 * *</div>
        </div>
      ) : (
        <>
          <div className="field">
            <label>数据源 *</label>
            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value, condition_json: '' }))}>
              <option value="">选择数据源</option>
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>条件 JSON *</label>
            <textarea value={form.condition_json} onChange={e => setForm(f => ({ ...f, condition_json: e.target.value }))} rows={4} placeholder='{"type":"days_since","field":"last_contact","value":30,"notify_interval":2592000}' />
            <div className="hint">
              可用字段：type(必填)、field、value、notify_interval(秒)、operator、minutes、hours、category、amount、period
            </div>
            {templates.length > 0 && (
              <div className="templates">
                <label>快速模板：</label>
                {templates.map((t, i) => (
                  <button type="button" key={i} className="btn small secondary" onClick={() => setForm(f => ({ ...f, condition_json: JSON.stringify(t.value, null, 2) }))}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <div className="field-row">
        <div className="field">
          <label>启用</label>
          <select value={form.enabled ? 1 : 0} onChange={e => setForm(f => ({ ...f, enabled: e.target.value === '1' }))}>
            <option value={1}>是</option>
            <option value={0}>否</option>
          </select>
        </div>
      </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>取消</button>
            <button type="submit" className="btn primary">{editing ? '保存' : '创建'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LogRow({ log }) {
  return (
    <tr>
      <td>{formatDate(log.sent_time || log.trigger_time)}</td>
      <td>{log.rule_id}</td>
      <td>{log.object_type}</td>
      <td>{log.object_id}</td>
      <td><span className={`status-badge ${log.status}`}>{log.status === 'sent' ? '已发送' : log.status === 'failed' ? '失败' : '跳过'}</span></td>
    </tr>
  )
}

export default function Reminders() {
  const [rules, setRules] = useState([])
  const [logs, setLogs] = useState([])
  const [settings, setSettings] = useState({ timezone: 'Asia/Shanghai' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('rules')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, l, s] = await Promise.all([
        get('/api/reminders'),
        get('/api/reminders?scope=logs'),
        get('/api/settings')
      ])
      setRules(r || [])
      setLogs(l || [])
      setSettings(s || { timezone: 'Asia/Shanghai' })
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleToggle = async (id, enabled) => {
    try {
      await patch(`/api/reminders/${id}`, { enabled: enabled ? 1 : 0 })
      fetchAll()
    } catch (e) { alert(e.message); fetchAll() }
  }

  const handleSave = async (payload) => {
    try {
      if (editing) await patch(`/api/reminders/${editing.id}`, payload)
      else await post('/api/reminders', payload)
      setModalOpen(false)
      setEditing(null)
      fetchAll()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除该规则？')) return
    try { await del(`/api/reminders/${id}`); fetchAll() } catch (e) { alert(e.message) }
  }

  return (
    <section>
      <header className="page-header">
        <h1>提醒中心</h1>
        <button className="btn primary" onClick={openCreate}>+ 新建规则</button>
      </header>

      <div className="tabs">
        <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>规则 ({rules.length})</button>
        <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>历史日志 ({logs.length})</button>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === 'rules' ? (
        loading ? <div className="loading">加载中...</div> : rules.length === 0 ? (
          <div className="empty">暂无规则，点击“新建规则”创建</div>
        ) : (
          <table className="rule-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>Schedule / Source</th>
                <th>下次触发</th>
                <th>状态</th>
                <th style={{ width: 180 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <RuleRow key={r.id} rule={r} onToggle={handleToggle} onEdit={openEdit} onDelete={handleDelete} settings={settings} />
              ))}
            </tbody>
          </table>
        )
      ) : (
        loading ? <div className="loading">加载中...</div> : logs.length === 0 ? (
          <div className="empty">暂无提醒记录</div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>规则ID</th>
                <th>对象类型</th>
                <th>对象ID</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => <LogRow key={i} log={l} />)}
            </tbody>
          </table>
        )
      )}

      {modalOpen && (
        <RuleModal
          rule={editing}
          settings={settings}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={async (payload) => {
            try {
              if (editing) await patch(`/api/reminders/${editing.id}`, payload)
              else await post('/api/reminders', payload)
              setModalOpen(false)
              setEditing(null)
              fetchAll()
            } catch (e) { alert(e.message) }
          }}
        />
      )}
    </section>
  )
}