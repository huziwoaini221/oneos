import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Tasks from './pages/Tasks.jsx'
import Calendar from './pages/Calendar.jsx'
import Contacts from './pages/Contacts.jsx'
import Finance from './pages/Finance.jsx'
import Reminders from './pages/Reminders.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
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
