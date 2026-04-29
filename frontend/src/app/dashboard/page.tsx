'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { NavBar } from '@/components/NavBar'
import { computeScore } from '@/lib/kpiScore'

// ─── Типы ────────────────────────────────────────────────────────────────────

type Submission = {
  id: string
  period_name: string
  role_name: string | null
  status: string
  submitted_at: string | null
  kpi_values: any[] | null
  reviewer_comment: string | null
}

type ReviewSub = {
  id: string
  employee_full_name: string
  employee_login: string
  period_name: string
  role_name: string | null
  status: string
  submitted_at: string | null
  kpi_values: any[] | null
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────


function computeKpiStats(kpiValues: any[] | null) {
  if (!kpiValues || kpiValues.length === 0) return null
  const _NUMERIC_FT = ['threshold', 'multi_threshold', 'quarterly_threshold']
  const ai      = kpiValues.filter((k: any) => k.formula_type === 'binary_auto')
  const manual  = kpiValues.filter((k: any) => k.formula_type === 'binary_manual')
  const numeric = kpiValues.filter((k: any) => _NUMERIC_FT.includes(k.formula_type))
  return {
    aiTotal:   ai.length,
    aiScored:  ai.filter((k: any) => k.score !== null).length,
    manTotal:  manual.length,
    manScored: manual.filter((k: any) => k.score !== null && !k.awaiting_manual_input).length,
    numTotal:  numeric.length,
    numFilled: numeric.filter((k: any) => k.fact_value !== null).length,
  }
}

function pendingManualCount(kpiValues: any[] | null): number {
  if (!kpiValues) return 0
  return kpiValues.filter((k: any) => k.formula_type === 'binary_manual' && k.awaiting_manual_input).length
}

function scoreColor(score: number | null) {
  if (score === null) return '#00e5ff'
  if (score >= 90) return '#00ff9d'
  if (score >= 70) return '#ffb800'
  return '#ff3b5c'
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#00e5ff', submitted: '#ffb800', approved: '#00ff9d', rejected: '#ff3b5c',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик', submitted: 'На проверке', approved: 'Утверждён', rejected: 'Возвращён',
}

// ─── Компонент: карточка своего отчёта ───────────────────────────────────────

function MySubmissionCard({ sub }: { sub: Submission }) {
  const router = useRouter()
  const score  = computeScore(sub.kpi_values)
  const stats  = computeKpiStats(sub.kpi_values)
  const statusColor = STATUS_COLOR[sub.status] || '#00e5ff'

  function handlePdf() {
    const token = localStorage.getItem('access_token')
    fetch(`/api/reports/${sub.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `KPI_${sub.period_name}.pdf`; a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => alert('Ошибка генерации PDF'))
  }

  return (
    <div className="submission-card fade-up" style={{ '--status-color': statusColor } as React.CSSProperties}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>

        {/* Левая колонка */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{sub.period_name}</span>
            <span className={`status-badge badge-${sub.status}`}>
              {STATUS_LABEL[sub.status] || sub.status}
            </span>
          </div>

          {sub.role_name && (
            <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6, opacity: 0.8 }}>
              {sub.role_name}
            </div>
          )}

          {sub.submitted_at && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
              Отправлен: {new Date(sub.submitted_at).toLocaleDateString('ru-RU')}
            </div>
          )}

          {sub.reviewer_comment && sub.status === 'rejected' && (
            <div style={{
              fontSize: 12, color: 'var(--warn)',
              background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 10,
            }}>
              💬 {sub.reviewer_comment}
            </div>
          )}

          {/* Индикаторы KPI */}
          {stats && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {stats.aiTotal > 0 && (
                <span style={{ fontSize: 11, color: stats.aiScored === stats.aiTotal ? '#00ff9d' : 'var(--text-dim)' }}>
                  ⚡ AI: {stats.aiScored}/{stats.aiTotal}
                </span>
              )}
              {stats.manTotal > 0 && (
                <span style={{ fontSize: 11, color: stats.manScored === stats.manTotal ? '#00ff9d' : 'var(--text-dim)' }}>
                  👤 Ручных: {stats.manScored}/{stats.manTotal}
                </span>
              )}
              {stats.numTotal > 0 && (
                <span style={{ fontSize: 11, color: stats.numFilled === stats.numTotal ? '#00ff9d' : 'var(--text-dim)' }}>
                  📊 Числовых: {stats.numFilled}/{stats.numTotal}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Правая колонка */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          {score !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: 'Orbitron, sans-serif', fontSize: 32, fontWeight: 900,
                color: scoreColor(score), lineHeight: 1,
                textShadow: `0 0 20px ${scoreColor(score)}`,
              }}>
                {score}%
              </div>
              <div style={{ marginTop: 6 }}>
                <div className="progress-wrap" style={{ minWidth: 120 }}>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${score}%`, background: scoreColor(score), color: scoreColor(score) }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Умная кнопка */}
          {sub.status === 'approved' ? (
            <button onClick={handlePdf} className="action-btn btn-pdf">📄 PDF</button>
          ) : sub.status === 'submitted' ? (
            <button onClick={() => router.push(`/kpi/${sub.id}`)} className="action-btn btn-view">
              👁 Просмотр
            </button>
          ) : (
            <button onClick={() => router.push(`/kpi/${sub.id}`)} className="action-btn btn-fill">
              {sub.status === 'rejected' ? '✏️ Исправить' : '📝 Заполнить'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser]               = useState<any>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [reviewSubs, setReviewSubs]   = useState<ReviewSub[]>([])
  const [allReview, setAllReview]     = useState<ReviewSub[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    setUser(u)

    const isManager = u.role === 'manager' || u.role === 'admin'
    const reqs: Promise<any>[] = [ api.get('/submissions/my') ]
    if (isManager) {
      reqs.push(api.get('/review/submissions?status=submitted').catch(() => ({ data: [] })))
      reqs.push(api.get('/review/submissions').catch(() => ({ data: [] })))
    }

    Promise.all(reqs).then(([myRes, subRes, allRes]) => {
      setSubmissions(myRes.data || [])
      if (subRes) setReviewSubs(subRes.data || [])
      if (allRes) setAllReview(allRes.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [router])

  if (!user) return null

  const isManager = user.role === 'manager' || user.role === 'admin'

  // Stat-карточки
  const statTotal     = allReview.length
  const statSubmitted = allReview.filter(s => s.status === 'submitted').length
  const statApproved  = allReview.filter(s => s.status === 'approved').length
  const statPending   = reviewSubs.length

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <NavBar pendingCount={reviewSubs.length} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Stat-карточки (manager/admin) ── */}
        {isManager && !loading && allReview.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 36, flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ '--card-accent': '#00e5ff' } as React.CSSProperties}>
              <div className="stat-label">Всего отчётов</div>
              <div className="stat-value">{statTotal}</div>
            </div>
            <div className="stat-card" style={{ '--card-accent': '#ffb800' } as React.CSSProperties}>
              <div className="stat-label">На проверке</div>
              <div className="stat-value">{statSubmitted}</div>
            </div>
            <div className="stat-card" style={{ '--card-accent': '#00ff9d' } as React.CSSProperties}>
              <div className="stat-label">Утверждено</div>
              <div className="stat-value">{statApproved}</div>
            </div>
            <div className="stat-card" style={{ '--card-accent': '#ff3b5c' } as React.CSSProperties}>
              <div className="stat-label">Ожидают меня</div>
              <div className="stat-value">{statPending}</div>
            </div>
          </div>
        )}

        {/* ── Ожидают проверки ── */}
        {isManager && reviewSubs.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div className="section-title-main">🔍 Ожидают проверки</div>
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, overflow: 'hidden',
            }}>
              <table className="review-table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Должность</th>
                    <th>Период</th>
                    <th>Оценка</th>
                    <th>Ручных</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reviewSubs.map((sub, i) => {
                    const score   = computeScore(sub.kpi_values)
                    const pending = pendingManualCount(sub.kpi_values)
                    return (
                      <tr key={sub.id} className="fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                        <td style={{ fontWeight: 600 }}>{sub.employee_full_name}</td>
                        <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{sub.role_name || '—'}</td>
                        <td style={{ color: 'var(--text-dim)' }}>{sub.period_name}</td>
                        <td>
                          {score !== null ? (
                            <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: scoreColor(score), fontSize: 14 }}>
                              {score}%
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {pending > 0 ? (
                            <span style={{ color: 'var(--warn)', fontSize: 12 }}>⏳ {pending}</span>
                          ) : (
                            <span style={{ color: '#00ff9d', fontSize: 12 }}>✅</span>
                          )}
                        </td>
                        <td>
                          <a href={`/review/${sub.id}`} className="action-btn btn-review" style={{ fontSize: 11, padding: '7px 14px' }}>
                            🔍 Проверить
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Мои отчёты ── */}
        <div>
          <div className="section-title-main">📋 Мои KPI-отчёты</div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div className="loader-ring" style={{ margin: '0 auto' }} />
              <p className="loader-text" style={{ marginTop: 16 }}>ЗАГРУЗКА...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div style={{
              padding: '48px 24px', textAlign: 'center',
              border: '1px dashed rgba(0,229,255,0.15)', borderRadius: 16,
              color: 'var(--text-dim)', fontSize: 14,
            }}>
              Нет активных KPI-отчётов за текущий период
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {submissions.map(sub => (
                <MySubmissionCard key={sub.id} sub={sub} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
