'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type Submission = {
  id: string
  employee_full_name: string
  employee_login: string
  period_name: string
  role_name: string | null
  status: string
  submitted_at: string | null
}

type TeamMember = {
  redmine_id: string
  full_name: string
  position_id: string | null
  role_name: string | null
  department_name: string | null
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Ожидает проверки',
  approved:  'Утверждён',
  rejected:  'Возвращён',
  draft:     'Черновик',
}

const STATUS_COLORS: Record<string, string> = {
  submitted: '#f59e0b',
  approved:  '#22c55e',
  rejected:  '#ef4444',
  draft:     '#94a3b8',
}

export default function ReviewPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('submitted')

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (!user) { router.push('/login'); return }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function loadData() {
    setLoading(true)
    try {
      const [subsRes, teamRes] = await Promise.all([
        api.get(`/review/submissions${filter ? `?status=${filter}` : ''}`),
        api.get('/review/my-team'),
      ])
      setSubmissions(subsRes.data)
      setTeam(teamRes.data.team || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const s: Record<string, any> = {
    page:      { padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' },
    card:      { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '0.75rem' },
    badge:     (status: string) => ({
      display: 'inline-block', padding: '0.2rem 0.6rem',
      background: (STATUS_COLORS[status] || '#94a3b8') + '20',
      color: STATUS_COLORS[status] || '#94a3b8',
      borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
    }),
    btn:       { padding: '0.4rem 0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' },
    filterBtn: (active: boolean) => ({
      padding: '0.4rem 0.875rem',
      background: active ? '#2563eb' : '#f1f5f9',
      color: active ? 'white' : '#334155',
      border: '1px solid ' + (active ? '#2563eb' : '#e2e8f0'),
      borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem',
    }),
  }

  return (
    <div style={s.page}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Дашборд</a>
        <h1 style={{ margin: '0.5rem 0 0.25rem' }}>Проверка отчётов</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>
          Команда: {team.length} сотрудников
        </p>
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'submitted', label: 'Ожидают проверки' },
          { key: 'approved',  label: 'Утверждённые' },
          { key: 'rejected',  label: 'Возвращённые' },
          { key: '',          label: 'Все' },
        ].map(({ key, label }) => (
          <button key={key} style={s.filterBtn(filter === key)} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Загрузка...</p>
      ) : submissions.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center' as const, color: '#64748b', padding: '3rem' }}>
          {filter === 'submitted' ? 'Нет отчётов, ожидающих проверки' : 'Отчётов не найдено'}
        </div>
      ) : (
        submissions.map(sub => (
          <div key={sub.id} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <strong>{sub.employee_full_name}</strong>
                  <span style={s.badge(sub.status)}>{STATUS_LABELS[sub.status] || sub.status}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {sub.period_name}
                  {sub.role_name && ` • ${sub.role_name}`}
                  {sub.submitted_at && ` • ${new Date(sub.submitted_at).toLocaleDateString('ru-RU')}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {sub.status === 'approved' && (
                  <a
                    href={`/api/reports/${sub.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '0.4rem 0.75rem', background: '#7c3aed', color: 'white',
                      borderRadius: '4px', textDecoration: 'none', fontSize: '0.8rem',
                    }}
                  >
                    PDF
                  </a>
                )}
                <button style={s.btn} onClick={() => router.push(`/review/${sub.id}`)}>
                  Открыть
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Команда */}
      {team.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '0.75rem' }}>
            Моя команда ({team.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {team.map(m => (
              <div key={m.redmine_id} style={{ ...s.card, marginBottom: 0, padding: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.full_name}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {m.role_name || m.position_id}
                </div>
                {m.department_name && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                    {m.department_name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
