'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

// ─── Типы ────────────────────────────────────────────────────────────────────

type Submission = {
  id: string
  period_name: string
  status: string
  submitted_at: string | null
  kpi_values: any[] | null
  reviewer_comment: string | null
}

type ReviewSub = {
  id: string
  employee_full_name: string
  period_name: string
  status: string
  submitted_at: string | null
  kpi_values: any[] | null
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function computeScore(kpiValues: any[] | null): number | null {
  if (!kpiValues || kpiValues.length === 0) return null
  const scored = kpiValues.filter((k: any) => k.score !== null && k.score !== undefined)
  if (scored.length === 0) return null
  const sw = scored.reduce((s: number, k: any) => s + k.weight, 0)
  return sw > 0 ? Math.round(scored.reduce((s: number, k: any) => s + k.score * k.weight, 0) / sw) : null
}

function computeKpiStats(kpiValues: any[] | null) {
  if (!kpiValues || kpiValues.length === 0) return null
  const ai      = kpiValues.filter((k: any) => k.kpi_type === 'binary_auto')
  const manual  = kpiValues.filter((k: any) => k.kpi_type === 'binary_manual')
  const numeric = kpiValues.filter((k: any) => k.kpi_type === 'numeric')
  return {
    aiTotal:     ai.length,
    aiScored:    ai.filter((k: any) => k.score !== null).length,
    manTotal:    manual.length,
    manScored:   manual.filter((k: any) => k.score !== null && !k.awaiting_manual_input).length,
    numTotal:    numeric.length,
    numFilled:   numeric.filter((k: any) => k.fact_value !== null).length,
  }
}

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-dim)'
  if (score >= 90) return 'var(--accent3)'
  if (score >= 70) return 'var(--warn)'
  return 'var(--danger)'
}

function progressColor(score: number | null): string {
  if (score === null) return 'var(--accent)'
  if (score >= 90) return 'var(--accent3)'
  if (score >= 70) return 'var(--warn)'
  return 'var(--danger)'
}

const STATUS_LABEL: Record<string, string> = {
  draft:     'Черновик',
  submitted: 'На проверке',
  approved:  'Утверждён',
  rejected:  'Возвращён',
}
const STATUS_CLASS: Record<string, string> = {
  submitted: 'badge-warn',
  approved:  'badge-success',
  rejected:  'badge-fail',
  draft:     'badge-dim',
}

// ─── Компонент: карточка своего отчёта ───────────────────────────────────────

function MySubmissionCard({ sub, role }: { sub: Submission; role: string }) {
  const score = computeScore(sub.kpi_values)
  const stats = computeKpiStats(sub.kpi_values)
  const router = useRouter()

  function handlePdf() {
    const token = localStorage.getItem('access_token')
    fetch(`/api/reports/${sub.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KPI_${sub.period_name}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => alert('Ошибка генерации PDF'))
  }

  const accentColor = sub.status === 'approved' ? 'var(--accent3)'
    : sub.status === 'rejected' ? 'var(--danger)'
    : sub.status === 'submitted' ? 'var(--warn)'
    : 'rgba(0,229,255,0.2)'

  return (
    <div
      className="cyber-card"
      style={{ '--accent-color': accentColor } as React.CSSProperties}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          {/* Имя периода + бейдж */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{sub.period_name}</span>
            <span className={`badge ${STATUS_CLASS[sub.status] || 'badge-dim'}`}>
              {STATUS_LABEL[sub.status] || sub.status}
            </span>
          </div>

          {/* Дата отправки */}
          {sub.submitted_at && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
              Отправлен: {new Date(sub.submitted_at).toLocaleDateString('ru-RU')}
            </div>
          )}

          {/* Комментарий руководителя */}
          {sub.reviewer_comment && sub.status === 'rejected' && (
            <div style={{
              fontSize: 12, color: 'var(--warn)',
              background: 'rgba(255,184,0,0.06)',
              border: '1px solid rgba(255,184,0,0.2)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 8,
            }}>
              💬 {sub.reviewer_comment}
            </div>
          )}

          {/* Прогресс-бар */}
          {score !== null && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                <span>Выполнение</span>
                <span style={{ fontFamily: 'Orbitron, sans-serif', color: progressColor(score) }}>{score}%</span>
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${score}%`, background: progressColor(score) }} />
              </div>
            </div>
          )}

          {/* Индикаторы KPI */}
          {stats && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              {stats.aiTotal > 0 && (
                <span style={{ fontSize: 11, color: stats.aiScored === stats.aiTotal ? 'var(--accent3)' : 'var(--text-dim)' }}>
                  ⚡ AI: {stats.aiScored}/{stats.aiTotal}
                </span>
              )}
              {stats.manTotal > 0 && (
                <span style={{ fontSize: 11, color: stats.manScored === stats.manTotal ? 'var(--accent3)' : 'var(--text-dim)' }}>
                  👤 Ручных: {stats.manScored}/{stats.manTotal}
                </span>
              )}
              {stats.numTotal > 0 && (
                <span style={{ fontSize: 11, color: stats.numFilled === stats.numTotal ? 'var(--accent3)' : 'var(--text-dim)' }}>
                  📊 Числовых: {stats.numFilled}/{stats.numTotal}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Правая колонка: score + кнопка */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {score !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 24, fontWeight: 700, color: scoreColor(score), lineHeight: 1 }}>
                {score}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>оценка</div>
            </div>
          )}

          {/* Умная кнопка */}
          {sub.status === 'approved' ? (
            <button
              onClick={handlePdf}
              className="cyber-btn cyber-btn-primary"
              style={{ fontSize: 12, padding: '7px 14px' }}
            >
              📄 PDF
            </button>
          ) : sub.status === 'submitted' ? (
            <button
              onClick={() => router.push(`/kpi/${sub.id}`)}
              className="cyber-btn"
              style={{ fontSize: 12, padding: '7px 14px' }}
            >
              👁 Просмотр
            </button>
          ) : (
            <button
              onClick={() => router.push(`/kpi/${sub.id}`)}
              className="cyber-btn cyber-btn-primary"
              style={{ fontSize: 12, padding: '7px 14px' }}
            >
              {sub.status === 'rejected' ? '✏️ Исправить' : '📝 Заполнить'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Компонент: карточка отчёта подчинённого ─────────────────────────────────

function ReviewCard({ sub }: { sub: ReviewSub }) {
  const router = useRouter()
  const score = computeScore(sub.kpi_values)

  return (
    <div
      className="cyber-card"
      style={{ '--accent-color': 'var(--warn)' } as React.CSSProperties}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{sub.employee_full_name}</span>
            <span className="badge badge-warn" style={{ fontSize: 10 }}>Ожидает проверки</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {sub.period_name}
            {sub.submitted_at && ` · ${new Date(sub.submitted_at).toLocaleDateString('ru-RU')}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {score !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, fontWeight: 700, color: scoreColor(score) }}>
                {score}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>оценка</div>
            </div>
          )}
          <button
            onClick={() => router.push(`/review/${sub.id}`)}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: '1px solid rgba(0,229,255,0.5)',
              background: 'rgba(0,229,255,0.12)',
              color: 'var(--accent)',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: 'Exo 2, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🔍 Проверить
          </button>
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
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    setUser(u)

    const requests: Promise<any>[] = [
      api.get('/submissions/my'),
    ]
    if (u.role === 'manager' || u.role === 'admin') {
      requests.push(api.get('/review/submissions?status=submitted').catch(() => ({ data: [] })))
    }

    Promise.all(requests).then(([myRes, revRes]) => {
      setSubmissions(myRes.data || [])
      if (revRes) setReviewSubs(revRes.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [router])

  function handleLogout() {
    localStorage.clear()
    router.push('/login')
  }

  if (!user) return null

  const isManager = user.role === 'manager' || user.role === 'admin'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 1 }}>

      {/* Хедер */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 900, letterSpacing: 3, color: 'var(--accent)', marginBottom: 6, textShadow: 'var(--glow)' }}>
            KPI ПОРТАЛ
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {user.full_name || user.login}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            {user.role === 'admin' ? 'Администратор'
              : user.role === 'manager' ? 'Руководитель'
              : user.role === 'finance' ? 'Финансовый блок'
              : 'Сотрудник'}
            {user.department && ` · ${user.department}`}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="cyber-btn"
          style={{ fontSize: 12, padding: '8px 16px' }}
        >
          Выйти
        </button>
      </div>

      {/* Быстрые ссылки */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
        {(isManager) && (
          <button
            onClick={() => router.push('/review')}
            className="cyber-btn cyber-btn-primary"
            style={{ fontSize: 13 }}
          >
            🔍 Проверка отчётов
            {reviewSubs.length > 0 && (
              <span style={{
                marginLeft: 8,
                background: 'var(--warn)',
                color: '#000',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 10,
              }}>
                {reviewSubs.length}
              </span>
            )}
          </button>
        )}
        {user.role === 'admin' && (
          <>
            <button onClick={() => router.push('/admin/periods')} className="cyber-btn" style={{ fontSize: 13 }}>
              📅 Периоды
            </button>
            <button onClick={() => router.push('/admin/notifications')} className="cyber-btn" style={{ fontSize: 13 }}>
              🔔 Уведомления
            </button>
            <button onClick={() => router.push('/admin')} className="cyber-btn" style={{ fontSize: 13 }}>
              ⚙️ Админ-панель
            </button>
          </>
        )}
        {(user.role === 'finance' || user.role === 'admin') && (
          <button onClick={() => router.push('/finance')} className="cyber-btn" style={{ fontSize: 13 }}>
            💰 Финансовый дашборд
          </button>
        )}
      </div>

      {/* Ожидают проверки (для руководителей) */}
      {isManager && reviewSubs.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div className="cyber-title" style={{ marginBottom: 14 }}>
            ⚡ ОЖИДАЮТ ПРОВЕРКИ ({reviewSubs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reviewSubs.map(sub => (
              <ReviewCard key={sub.id} sub={sub} />
            ))}
          </div>
        </div>
      )}

      {/* Мои отчёты */}
      <div>
        <div className="cyber-title" style={{ marginBottom: 14 }}>
          МОИ KPI-ОТЧЁТЫ
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="loader-ring" style={{ margin: '0 auto' }} />
            <p className="loader-text" style={{ marginTop: 16 }}>ЗАГРУЗКА...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div style={{
            padding: '40px 24px',
            border: '1px dashed rgba(0,229,255,0.15)',
            borderRadius: 16,
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: 14,
          }}>
            Нет активных KPI-отчётов за текущий период
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {submissions.map(sub => (
              <MySubmissionCard key={sub.id} sub={sub} role={user.role} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
