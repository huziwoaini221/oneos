import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Tasks from './pages/Tasks.jsx'
import Calendar from './pages/Calendar.jsx'
import Contacts from './pages/Contacts.jsx'
import Finance from './pages/Finance.jsx'
import Reminders from './pages/Reminders.jsx'
import Settings from './pages/Settings.jsx'
import { getToken, setToken, tokenFromUrl } from './api.js'

function Login() {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [checking, setChecking] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setChecking(true)
    setToken(pwd.trim())
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${pwd.trim()}` }
      })
      if (res.ok) {
        window.location.reload()
      } else {
        setToken('')
        setErr('密码错误')
        setChecking(false)
      }
    } catch {
      setToken('')
      setErr('网络错误，请重试')
      setChecking(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h2>LifeHub</h2>
        <p className="login-hint">请输入访问密码</p>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="访问密码"
          autoFocus
        />
        {err && <div className="login-err">{err}</div>}
        <button type="submit" disabled={checking}>
          {checking ? '验证中…' : '进入'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  tokenFromUrl()
  const authed = !!getToken()
  if (!authed) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
