'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

type NavTab = { icon: string; label: string; href: string }

const TABS_BY_ROLE: Record<string, NavTab[]> = {
  employee: [
    { icon: '📋', label: 'Мои отчёты', href: '/dashboard' },
  ],
  manager: [
    { icon: '📋', label: 'Мои отчёты', href: '/dashboard' },
    { icon: '🔍', label: 'Проверка',   href: '/review' },
  ],
  admin: [
    { icon: '📋', label: 'Мои отчёты',  href: '/dashboard' },
    { icon: '🔍', label: 'Проверка',    href: '/review' },
    { icon: '📅', label: 'Периоды',     href: '/admin/periods' },
    { icon: '🔔', label: 'Уведомления', href: '/admin/notifications' },
    { icon: '⚙️', label: 'Админ',       href: '/admin' },
  ],
  finance: [
    { icon: '💰', label: 'Финансы', href: '/finance' },
  ],
}

const ROLE_LABEL: Record<string, string> = {
  employee: 'Сотрудник',
  manager:  'Руководитель',
  admin:    'Администратор',
  finance:  'Финансы',
}

export function NavBar({ pendingCount = 0 }: { pendingCount?: number }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))
  }, [])

  if (!user) return null

  const tabs = TABS_BY_ROLE[user.role] || TABS_BY_ROLE.employee

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/admin') return pathname === '/admin'
    return pathname?.startsWith(href) ?? false
  }

  function handleLogout() {
    localStorage.clear()
    router.push('/login')
  }

  return (
    <nav className="nav">
      <a href="/dashboard" className="nav-logo">KPI ПОРТАЛ</a>

      {tabs.map(tab => (
        <a key={tab.href} href={tab.href} className={`nav-tab ${isActive(tab.href) ? 'active' : ''}`}>
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
          {tab.href === '/review' && pendingCount > 0 && (
            <span style={{
              background: 'var(--warn)', color: '#000',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 9, fontWeight: 700,
              padding: '1px 5px', borderRadius: 8,
            }}>
              {pendingCount}
            </span>
          )}
        </a>
      ))}

      <div className="nav-separator" />

      <div className="nav-user">
        <span className="nav-username">{user.full_name || user.login}</span>
        <span className="nav-role">{ROLE_LABEL[user.role] || user.role}</span>
        <button className="nav-logout" onClick={handleLogout}>Выйти</button>
      </div>
    </nav>
  )
}
