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
  kpi_values: any[] | null
}

type TeamMember = {
  redmine_id: string
  full_name: string
  position_id: string | null
  role_name: string | null
  department_name: string | null
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Ожидает проверки',
  approved:  'Утверждён',
  rejected:  'Возвращён',
  draft:     'Черновик',
}

const STATUS_CLASS: Record<string, string> = {
  submitted: 'badge-warn',
  approved:  'badge-success',
  rejected:  'badge-fail',
  draft:     'badge-dim',
}

function computeScore(kpiValues: any[] | null): number | null {
  if (!kpiValues || kpiValues.length === 0) return null
  const scored = kpiValues.filter(k => k.score !== null && k.score !== undefined)
  if (scored.length === 0) return null
  const sw = scored.reduce((s, k) => s + k.weight, 0)
  return Math.round(scored.reduce((s, k) => s + k.score * k.weight, 0) / sw)
}

const FILTERS = [
  { key: 'submitted', label: 'Ожидают проверки' },
  { key: 'approved',  label: 'Утверждённые' },
  { key: 'rejected',  label: 'Возвращённые' },
  { key: '',          label: 'Все' },
]

export default function ReviewPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('submitted')

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/login'); return }
    loadData()
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

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 1 }}>

      {/* Хедер */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 16, fontFamily: 'Exo 2, sans-serif' }}
        >
          ← Дашборд
        </button>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 900, letterSpacing: 3, color: 'var(--accent)', marginBottom: 6, textShadow: 'var(--glow)' }}>
          KPI ПОРТАЛ
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
          Проверка отчётов
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
          Команда: {team.length} сотрудников
        </div>
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: `1px solid ${filter === key ? 'rgba(0,229,255,0.4)' : 'var(--card-border)'}`,
              background: filter === key ? 'rgba(0,229,255,0.1)' : 'var(--card)',
              color: filter === key ? 'var(--accent)' : 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'Exo 2, sans-serif',
              fontWeight: filter === key ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Список */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="loader-ring" style={{ margin: '0 auto' }} />
          <p className="loader-text" style={{ marginTop: 16 }}>ЗАГРУЗКА...</p>
        </div>
      ) : submissions.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          border: '1px dashed rgba(0,229,255,0.2)',
          borderRadius: 16,
          textAlign: 'center',
          color: 'var(--text-dim)',
        }}>
          {filter === 'submitted' ? 'Нет отчётов, ожидающих проверки' : 'Отчётов не найдено'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {submissions.map(sub => {
            const score = computeScore(sub.kpi_values)
            const scoreColor = score === null ? 'var(--text-dim)'
              : score >= 90 ? 'var(--accent3)'
              : score >= 70 ? 'var(--warn)'
              : 'var(--danger)'

            return (
              <div
                key={sub.id}
                className="cyber-card"
                style={{ '--accent-color': sub.status === 'approved' ? 'var(--accent3)' : sub.status === 'rejected' ? 'var(--danger)' : 'var(--warn)' } as React.CSSProperties}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{sub.employee_full_name}</span>
                      <span className={`badge ${STATUS_CLASS[sub.status] || 'badge-dim'}`}>
                        {STATUS_LABEL[sub.status] || sub.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {sub.period_name}
                      {sub.role_name && ` · ${sub.role_name}`}
                      {sub.submitted_at && ` · ${new Date(sub.submitted_at).toLocaleDateString('ru-RU')}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {score !== null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 22, fontWeight: 700, color: scoreColor }}>
                          {score}%
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>оценка</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {sub.status === 'approved' && (
                        <a
                          href={`/api/reports/${sub.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cyber-btn cyber-btn-primary"
                          style={{ textDecoration: 'none', padding: '7px 14px', fontSize: 12 }}
                        >
                          📄 PDF
                        </a>
                      )}
                      <button
                        className="cyber-btn cyber-btn-primary"
                        style={{ padding: '7px 16px', fontSize: 13 }}
                        onClick={() => router.push(`/review/${sub.id}`)}
                      >
                        Открыть →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Команда */}
      {team.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div className="cyber-title" style={{ marginBottom: 16 }}>
            МОЯ КОМАНДА ({team.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {team.map(m => (
              <div
                key={m.redmine_id}
                className="cyber-card"
                style={{ padding: 14, '--accent-color': 'rgba(0,229,255,0.2)' } as React.CSSProperties}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                  {m.role_name || m.position_id}
                </div>
                {m.department_name && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, opacity: 0.7 }}>
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
