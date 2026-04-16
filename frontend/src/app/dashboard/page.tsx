'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

const STATUS_LABELS: Record<string, string> = {
  draft:     'Черновик',
  submitted: 'На проверке',
  approved:  'Утверждён',
  rejected:  'Возвращён',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#dbeafe', color: '#1d4ed8' },
  submitted: { bg: '#fef9c3', color: '#92400e' },
  approved:  { bg: '#dcfce7', color: '#166534' },
  rejected:  { bg: '#fee2e2', color: '#991b1b' },
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) {
      router.push('/login')
      return
    }
    const u = JSON.parse(stored)
    setUser(u)
    api.get('/submissions/my').then(res => setSubmissions(res.data)).catch(() => {})
  }, [router])

  function handleLogout() {
    localStorage.clear()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
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

      {/* Карточка пользователя */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{ marginTop: 0 }}>Добро пожаловать</h2>
        <p style={{ margin: '0.25rem 0' }}><strong>Имя:</strong> {user.full_name}</p>
        <p style={{ margin: '0.25rem 0' }}><strong>Логин:</strong> {user.login}</p>
        <p style={{ margin: '0.25rem 0' }}><strong>Роль:</strong> {user.role}</p>
        {user.department && <p style={{ margin: '0.25rem 0' }}><strong>Подразделение:</strong> {user.department}</p>}
        {user.role === 'admin' && (
          <>
            <a href="/admin/periods" style={{
              display: 'inline-block', marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#2563eb', color: 'white',
              borderRadius: '6px', textDecoration: 'none',
              fontSize: '0.875rem',
            }}>
              Управление периодами
            </a>
            <a href="/admin/notifications" style={{
              display: 'inline-block', marginTop: '1rem', marginLeft: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#0891b2', color: 'white',
              borderRadius: '6px', textDecoration: 'none',
              fontSize: '0.875rem',
            }}>
              Уведомления
            </a>
            <a href="/admin" style={{
              display: 'inline-block', marginTop: '1rem', marginLeft: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#1e293b', color: 'white',
              borderRadius: '6px', textDecoration: 'none',
              fontSize: '0.875rem',
            }}>
              ⚙️ Админ-панель
            </a>
          </>
        )}
        {(user.role === 'manager' || user.role === 'admin') && (
          <a href="/review" style={{
            display: 'inline-block',
            marginTop: '0.5rem',
            marginLeft: user.role === 'admin' ? '0.5rem' : '0',
            padding: '0.5rem 1rem',
            background: '#f59e0b', color: 'white',
            borderRadius: '6px', textDecoration: 'none',
            fontSize: '0.875rem',
          }}>
            Проверка отчётов
          </a>
        )}
      </div>

      {/* KPI-отчёты */}
      {submissions.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Мои KPI-отчёты</h2>
          {submissions.map((s: any) => {
            const sc = STATUS_COLORS[s.status] || STATUS_COLORS.draft
            return (
              <div key={s.id} style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                marginBottom: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{s.period_name}</div>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.5rem',
                    background: sc.bg, color: sc.color,
                    borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                  {s.submitted_at && (
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      Отправлен: {new Date(s.submitted_at).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </div>
                <a href={`/kpi/${s.id}`} style={{
                  padding: '0.4rem 0.875rem',
                  background: '#2563eb', color: 'white',
                  borderRadius: '4px', textDecoration: 'none',
                  fontSize: '0.8rem', flexShrink: 0,
                }}>
                  Открыть
                </a>
              </div>
            )
          })}
        </div>
      )}

      {submissions.length === 0 && (
        <div style={{
          background: 'white', border: '1px solid #e2e8f0',
          borderRadius: '8px', padding: '2rem',
          textAlign: 'center', color: '#94a3b8',
        }}>
          Нет активных KPI-отчётов за текущий период
        </div>
      )}
    </div>
  )
}
