'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(stored))
  }, [router])

  function handleLogout() {
    localStorage.clear()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>KPI Портал</h1>
          <p style={{ color: '#666', margin: '0.25rem 0 0' }}>ГКУ МО «Региональный центр торгов»</p>
        </div>
        <button onClick={handleLogout} style={{
          padding: '0.5rem 1rem',
          background: '#f1f5f9',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
        }}>
          Выйти
        </button>
      </div>

      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        maxWidth: '400px',
      }}>
        <h2 style={{ marginTop: 0 }}>Добро пожаловать</h2>
        <p><strong>Имя:</strong> {user.full_name}</p>
        <p><strong>Логин:</strong> {user.login}</p>
        <p><strong>Роль:</strong> {user.role}</p>
        {user.department && <p><strong>Подразделение:</strong> {user.department}</p>}
      </div>
    </div>
  )
}
