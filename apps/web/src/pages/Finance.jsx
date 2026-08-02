import { useEffect, useState, useCallback, useMemo } from 'react'
import { get, post, del } from '../api.js'

const CATEGORY_OPTIONS = [
  '餐饮', '交通', '购物', '娱乐', '医疗', '教育', '住房', '通讯', '其他'
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN')
}

function formatMonth(iso) {
  if (!iso) return '—'
  return iso.slice(0, 7)
}

function ExpenseRow({ exp, onDelete }) {
  return (
    <tr>
      <td>{formatDate(exp.date)}</td>
      <td><span className="badge category">{exp.category}</span></td>
      <td className="amount">¥{exp.amount.toFixed(2)}</td>
      <td>{exp.note || '—'}</td>
      <td>
        <button className="btn small danger" onClick={() => { if (window.confirm('确定删除？')) onDelete(exp.id) }}>删除</button>
      </td>
    </tr>
  )
}

function ExpenseModal({ onClose, onSave, defaultDate }) {
  const [form, setForm] = useState({
    amount: '',
    category: '餐饮',
    date: defaultDate || new Date().toISOString().slice(0, 10),
    note: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount || isNaN(parseFloat(form.amount))) { alert('请填写正确金额'); return }
    if (!form.date) { alert('请选择日期'); return }
    try {
      await onSave({ ...form, amount: parseFloat(form.amount) })
      onClose()
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>记一笔</h3>
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>金额 *</label>
              <input type="number" step="0.01" min="0" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="如 25.50" />
            </div>
            <div className="field">
              <label>分类 *</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>日期 *</label>
              <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="field">
              <label>备注</label>
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="备注" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>取消</button>
            <button type="submit" className="btn primary">记录</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MonthlyChart({ expenses, month }) {
  const cats = useMemo(() => {
    const map = {}
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expenses])

  const total = cats.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="chart-section">
      <h4>{month} 支出汇总</h4>
      <div className="chart-total">总计 ¥{total.toFixed(2)}</div>
      <div className="chart-bars">
        {cats.map(([cat, val]) => (
          <div key={cat} className="chart-bar">
            <span className="bar-label">{cat}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: total > 0 ? `${(val/total)*100}%` : '0%' }}></div>
            </div>
            <span className="bar-value">¥{val.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Finance() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7))
  const [modalOpen, setModalOpen] = useState(false)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const url = monthFilter ? `/api/finance?month=${monthFilter}` : '/api/finance'
      const data = await get(url)
      setExpenses(data || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [monthFilter])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const handleSave = async (payload) => {
    await post('/api/finance', payload)
    fetchExpenses()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除？')) return
    try { await del(`/api/finance/${id}`); fetchExpenses() } catch (e) { alert(e.message) }
  }

  const monthExpenses = useMemo(() => expenses.filter(e => formatMonth(e.date) === monthFilter), [expenses, monthFilter])
  const total = useMemo(() => monthExpenses.reduce((s, e) => s + (e.amount || 0), 0), [monthExpenses])
  const byCategory = useMemo(() => {
    const m = {}
    monthExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [monthExpenses])

  if (loading) return <div className="loading">加载中...</div>

  return (
    <section>
      <header className="page-header">
        <h1>家庭财务</h1>
        <div className="header-actions">
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i)
              return <option key={i} value={d.toISOString().slice(0, 7)}>{d.toLocaleString('zh-CN', { year: 'numeric', month: 'long' })}</option>
            })}
          </select>
          <button className="btn primary" onClick={() => { setModalOpen(true); }}>+ 记一笔</button>
        </div>
      </header>

      <div className="finance-summary">
        <div className="stat-card">
          <div className="stat-label">本月总支出</div>
          <div className="stat-value expense">¥{total.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">笔数</div>
          <div className="stat-value">{monthExpenses.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">分类数</div>
          <div className="stat-value">{byCategory.length}</div>
        </div>
      </div>

      <div className="finance-body">
        <div className="finance-list">
          <h3>明细</h3>
          {error && <div className="error">{error}</div>}
          {monthExpenses.length === 0 ? (
            <p className="empty">本月暂无记录，点击“记一笔”开始</p>
          ) : (
            <table className="expense-table">
              <thead>
                <tr><th>日期</th><th>分类</th><th>金额</th><th>备注</th><th style={{ width: 80 }}>操作</th></tr>
              </thead>
              <tbody>
                {monthExpenses.map(e => <ExpenseRow key={e.id} exp={e} onDelete={handleDelete} />)}
              </tbody>
            </table>
          )}
        </div>

        <div className="finance-chart">
          <MonthlyChart expenses={monthExpenses} month={monthFilter} />
        </div>
      </div>

      {modalOpen && <ExpenseModal onClose={() => setModalOpen(false)} onSave={handleSave} />}
    </section>
  )
}