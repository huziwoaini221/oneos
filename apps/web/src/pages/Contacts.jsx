import { useEffect, useState, useCallback } from 'react'
import { get, post, patch, del } from '../api.js'

const LEVEL_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'normal', label: '普通' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '关键' }
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN')
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function LevelBadge({ level }) {
  const colors = { low: '#22c55e', normal: '#3b82f6', high: '#f59e0b', critical: '#ef4444' }
  const labels = { low: '低', normal: '普通', high: '高', critical: '关键' }
  return (
    <span className="badge" style={{ background: colors[level] || '#94a3b8' }}>
      {labels[level] || level}
    </span>
  )
}

function ContactRow({ contact, onContact, onEdit, onDelete }) {
  const d = daysSince(contact.last_contact)
  return (
    <tr className={d !== null && d > 30 ? 'overdue' : ''}>
      <td>
        <div className="contact-name">{contact.name}</div>
        {contact.company && <div className="contact-company">{contact.company}</div>}
      </td>
      <td>{contact.email || contact.phone || contact.wechat || '—'}</td>
      <td><LevelBadge level={contact.level} /></td>
      <td className={d !== null && d > 30 ? 'overdue' : ''}>
        {contact.last_contact ? `${d} 天前` : '从未联系'}
      </td>
      <td>{contact.next_followup ? formatDate(contact.next_followup) : '—'}</td>
      <td>
        <button className="btn small" onClick={() => onContact(contact.id)}>记录联系</button>
        <button className="btn small secondary" onClick={() => onEdit(contact)}>编辑</button>
        <button className="btn small danger" onClick={() => onDelete(contact.id)}>删除</button>
      </td>
    </tr>
  )
}

function ContactModal({ contact, onClose, onSave }) {
  const editing = !!contact
  const [form, setForm] = useState({
    name: contact?.name || '',
    company: contact?.company || '',
    country: contact?.country || '',
    industry: contact?.industry || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    wechat: contact?.wechat || '',
    telegram: contact?.telegram || '',
    level: contact?.level || 'normal',
    last_contact: contact?.last_contact || '',
    next_followup: contact?.next_followup || '',
    notes: contact?.notes || ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = { ...form }
    Object.keys(payload).forEach(k => payload[k] === '' && delete payload[k])
    await onSave(payload)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{editing ? '编辑联系人' : '新建联系人'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>姓名 *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="姓名" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>公司</label>
              <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="公司" />
            </div>
            <div className="field">
              <label>职位/行业</label>
              <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="职位/行业" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>国家/地区</label>
              <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="国家" />
            </div>
            <div className="field">
              <label>重要程度</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
                {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>电话</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="电话" />
            </div>
            <div className="field">
              <label>邮箱</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="邮箱" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>微信</label>
              <input value={form.wechat} onChange={e => setForm({ ...form, wechat: e.target.value })} placeholder="微信" />
            </div>
            <div className="field">
              <label>Telegram</label>
              <input value={form.telegram} onChange={e => setForm({ ...form, telegram: e.target.value })} placeholder="Telegram ID" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>最后联系</label>
              <input type="date" value={form.last_contact} onChange={e => setForm({ ...form, last_contact: e.target.value })} />
            </div>
            <div className="field">
              <label>下次跟进</label>
              <input type="date" value={form.next_followup} onChange={e => setForm({ ...form, next_followup: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>备注</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="备注..." />
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

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const url = filterLevel ? `/api/contacts?level=${filterLevel}` : '/api/contacts'
      const data = await get(url)
      setContacts(data || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [filterLevel])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (c) => { setEditing(c); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleContact = async (id) => {
    try {
      await patch(`/api/contacts/${id}`, { last_contact: new Date().toISOString().slice(0, 10) })
      fetchContacts()
    } catch (e) { alert(e.message) }
  }

  const handleSave = async (payload) => {
    try {
      if (editing) await patch(`/api/contacts/${editing.id}`, payload)
      else await post('/api/contacts', payload)
      closeModal()
      fetchContacts()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除该联系人？')) return
    try { await del(`/api/contacts/${id}`); fetchContacts() } catch (e) { alert(e.message) }
  }

  const filtered = contacts.filter(c => !filterLevel || c.level === filterLevel)

  return (
    <section>
      <header className="page-header">
        <h1>联系人</h1>
        <button className="btn primary" onClick={openCreate}>+ 新建联系人</button>
      </header>

      <div className="filters">
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">全部等级</option>
          {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? <div className="loading">加载中...</div> : filtered.length === 0 ? (
        <div className="empty">{contacts.length === 0 ? '暂无联系人' : '当前筛选下无联系人'}</div>
      ) : (
        <table className="contact-table">
          <thead>
            <tr>
              <th>姓名 / 公司</th>
              <th>联系方式</th>
              <th>等级</th>
              <th>最后联系</th>
              <th>下次跟进</th>
              <th style={{ width: 220 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <ContactRow
                key={c.id}
                contact={c}
                onContact={handleContact}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <ContactModal
          contact={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={async (payload) => {
            try {
              if (editing) await patch(`/api/contacts/${editing.id}`, payload)
              else await post('/api/contacts', payload)
              setModalOpen(false)
              setEditing(null)
              fetchContacts()
            } catch (e) { alert(e.message) }
          }}
        />
      )}
    </section>
  )
}