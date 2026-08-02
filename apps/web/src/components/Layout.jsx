import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/finance', label: 'Finance' },
  { to: '/reminders', label: 'Reminders' },
  { to: '/settings', label: 'Settings' }
]

export default function Layout() {
  return (
    <div className="app">
      <nav className="nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
