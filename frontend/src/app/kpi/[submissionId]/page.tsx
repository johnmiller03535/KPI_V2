'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { NumericInput } from '@/components/kpi/NumericInput'
import { ScoreHeader } from '@/components/kpi/ScoreHeader'
import { NavBar } from '@/components/NavBar'

// --- Types ---

type KpiResult = {
  indicator: string
  criterion: string
  formula_type: string
  weight: number
  is_common: boolean
  cumulative: boolean
  kpi_type: string
  score: number | null
  confidence: number | null
  summary: string | null
  awaiting_manual_input: boolean
  requires_fact_input: boolean
  requires_review: boolean
  ai_low_confidence: boolean
  parsed_thresholds: Array<{ conditions: string[]; score: number }> | null
  fact_value: number | null
}

type Submission = {
  id: string
  employee_login: string
  period_name: string
  position_id: string | null
  status: string
  kpi_values: KpiResult[] | null
  summary_text: string | null
  ai_generated_at: string | null
  reviewer_comment: string | null
}

type ScoreData = {
  partial_score: number | null
  total_weight: number
  scored_weight: number
  completion_pct: number
}

type RoleInfo = { role: string; unit: string } | null

// ---

export default function KpiFormPage({ params }: { params: { submissionId: string } }) {
  const { submissionId } = params
  const router = useRouter()

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [scoreData, setScoreData] = useState<ScoreData | null>(null)
  const [roleInfo, setRoleInfo] = useState<RoleInfo>(null)
  const [employeeName, setEmployeeName] = useState('')
  const [loading, setLoading] = useState(true)
  const [summaryText, setSummaryText] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiResultShown, setAiResultShown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (!stored) { router.push('/login'); return }
    const user = JSON.parse(stored)
    setEmployeeName(user.firstname && user.lastname
      ? `${user.firstname} ${user.lastname}`
      : user.login || '')
    loadAll()
  }, [submissionId])

  async function loadAll() {
    try {
      const [subRes, scoreRes, structRes] = await Promise.all([
        api.get(`/submissions/my/${submissionId}`),
        api.get(`/submissions/my/${submissionId}/score`).catch(() => ({ data: null })),
        api.get(`/submissions/my/${submissionId}/kpi-structure`).catch(() => ({ data: null })),
      ])
      setSubmission(subRes.data)
      setScoreData(scoreRes.data)
      if (structRes.data?.role_info) setRoleInfo(structRes.data.role_info)
      // Восстановить summary_text из БД если уже загружали раньше
      if (subRes.data?.summary_text) {
        setSummaryText(subRes.data.summary_text)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function refreshScore() {
    try {
      const res = await api.get(`/submissions/my/${submissionId}/score`)
      setScoreData(res.data)
    } catch {}
  }

  // ─── Загрузить саммари из Redmine ─────────────────────────────────────────

  const handleLoadSummary = async () => {
    setSummaryLoading(true)
    try {
      const res = await api.post(`/submissions/my/${submissionId}/load-summary`)
      const data = res.data
      setSummaryText(data.summary_text)
      // Обновить kpi_values в state (структура инициализирована)
      if (data.kpi_values) {
        setSubmission(prev => prev ? { ...prev, kpi_values: data.kpi_values } : prev)
      }
      await refreshScore()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка загрузки трудозатрат из Redmine')
    } finally {
      setSummaryLoading(false)
    }
  }

  // ─── Редактирование саммари с debounce ────────────────────────────────────

  const handleSummaryChange = (text: string) => {
    setSummaryText(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        await api.patch(`/submissions/my/${submissionId}/summary`, { summary_text: text })
      } catch (e) {
        console.error('Ошибка сохранения саммари:', e)
      }
    }, 800)
  }

  // ─── Ввод числового факта ─────────────────────────────────────────────────

  const handleNumericUpdate = useCallback(async (criterion: string, factValue: number) => {
    try {
      await api.patch(`/submissions/my/${submissionId}`, {
        numeric_values: { [criterion]: { fact_value: factValue } },
      })
      const [subRes, scoreRes] = await Promise.all([
        api.get(`/submissions/my/${submissionId}`),
        api.get(`/submissions/my/${submissionId}/score`),
      ])
      setSubmission(subRes.data)
      setScoreData(scoreRes.data)
    } catch (e) {
      console.error('Ошибка сохранения факта:', e)
    }
  }, [submissionId])

  // ─── Отправить на проверку (AI оценивает в этот момент) ──────────────────

  const handleSubmit = async () => {
    if (!confirm('Отправить отчёт на проверку?\nAI сейчас оценит ваши показатели. После отправки редактирование недоступно.')) return
    setSubmitting(true)
    try {
      const res = await api.post(`/submissions/my/${submissionId}/submit`)
      const updatedSub: Submission = res.data
      setSubmission(updatedSub)
      setAiResultShown(true)
      // Обновить score
      await refreshScore()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Derived state ---

  const kpiValues: KpiResult[] = submission?.kpi_values || []
  const binaryAuto   = kpiValues.filter(k => k.kpi_type === 'binary_auto')
  const numeric      = kpiValues.filter(k => k.kpi_type === 'numeric')
  const binaryManual = kpiValues.filter(k => k.kpi_type === 'binary_manual')

  const isEditable = submission?.status === 'draft' || submission?.status === 'rejected'
  const summaryLoaded = summaryText !== null
  const hasUnfilledNumeric = numeric.some(k => k.score === null && k.fact_value === null)
  const lowConfidenceCount = binaryAuto.filter(k => k.ai_low_confidence).length

  // --- Render ---

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loader-ring" style={{ margin: '0 auto' }} />
          <p className="loader-text">ЗАГРУЗКА...</p>
        </div>
      </div>
    )
  }

  if (!submission) {
    return (
      <div style={{ padding: 32, position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'var(--danger)' }}>Отчёт не найден</p>
        <button className="cyber-btn cyber-btn-primary" onClick={() => router.push('/dashboard')}>← Дашборд</button>
      </div>
    )
  }

  return (
    <>
      {/* Лоадер при загрузке саммари или AI-анализе */}
      {(summaryLoading || submitting) && (
        <div className="loader-overlay">
          <div className="loader-ring" />
          <p className="loader-text">
            {submitting ? 'AI АНАЛИЗИРУЕТ...' : 'ЗАГРУЗКА ТРУДОЗАТРАТ...'}
          </p>
        </div>
      )}

      <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <NavBar />

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <a href="/dashboard">KPI ПОРТАЛ</a>
        <span className="breadcrumb-sep">›</span>
        <a href="/dashboard">Мои отчёты</a>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{submission?.period_name || '...'}</span>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 40px', position: 'relative', zIndex: 1 }}>

        {/* Хедер */}
        <ScoreHeader
          employeeName={employeeName}
          periodName={submission.period_name}
          status={submission.status}
          roleInfo={roleInfo}
          scoreData={scoreData}
          reviewerComment={submission.reviewer_comment}
          isEditable={isEditable}
          summaryLoading={summaryLoading}
          summaryLoaded={summaryLoaded}
          submitting={submitting}
          hasUnfilledNumeric={isEditable && hasUnfilledNumeric}
          onLoadSummary={handleLoadSummary}
          onSubmit={handleSubmit}
          onBack={() => router.push('/dashboard')}
        />

        {/* Баннер статуса submitted */}
        {submission.status === 'submitted' && (
          <div style={{
            marginBottom: 24, padding: '14px 18px', borderRadius: 12,
            border: '1px solid rgba(255,184,0,0.35)', background: 'rgba(255,184,0,0.07)',
            color: 'var(--warn)', fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span>Отчёт отправлен на проверку руководителю. Редактирование недоступно.</span>
          </div>
        )}

        {/* Баннер статуса approved */}
        {submission.status === 'approved' && (
          <div style={{
            marginBottom: 24, padding: '14px 18px', borderRadius: 12,
            border: '1px solid rgba(0,255,157,0.35)', background: 'rgba(0,255,157,0.07)',
            color: 'var(--accent3)', fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span>Отчёт утверждён руководителем.</span>
          </div>
        )}

        {/* Предупреждение о низкой уверенности AI (показывается сразу после submit) */}
        {aiResultShown && lowConfidenceCount > 0 && (
          <div style={{
            marginBottom: 24, padding: '14px 18px', borderRadius: 12,
            border: '1px solid rgba(255,184,0,0.35)', background: 'rgba(255,184,0,0.07)',
            color: 'var(--warn)', fontSize: 14,
          }}>
            <strong>⚠️ AI оценил {lowConfidenceCount} показател{lowConfidenceCount === 1 ? 'ь' : lowConfidenceCount < 5 ? 'я' : 'ей'} с низкой уверенностью (&lt;50%).</strong>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 400 }}>
              Руководитель примет финальное решение по этим показателям.
            </div>
          </div>
        )}

        {/* Баннер: нет саммари — призыв загрузить */}
        {kpiValues.length === 0 && isEditable && (
          <div style={{
            padding: '18px 20px', border: '1px solid rgba(0,229,255,0.4)',
            borderRadius: 12, background: 'rgba(0,229,255,0.05)',
            marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 28 }}>📥</span>
            <div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, letterSpacing: 2, color: 'var(--accent)', marginBottom: 4 }}>
                НАЖМИТЕ «ЗАГРУЗИТЬ САММАРИ ИЗ REDMINE»
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                Система сформирует текст-заготовку из трудозатрат. Вы сможете отредактировать его перед отправкой.
              </div>
            </div>
          </div>
        )}

        {/* ─── Блок саммари ─────────────────────────────────────────────────── */}
        {summaryText !== null && isEditable && (
          <div className="cyber-card" style={{ marginBottom: 28 }}>
            <div style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'Orbitron, sans-serif', letterSpacing: 2, marginBottom: 10 }}>
              САММАРИ ВЫПОЛНЕННЫХ РАБОТ
            </div>
            <textarea
              value={summaryText}
              onChange={e => handleSummaryChange(e.target.value)}
              rows={7}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(0,229,255,0.25)',
                borderRadius: 8, color: 'var(--text)',
                padding: '12px 14px',
                fontFamily: 'Exo 2, sans-serif',
                fontSize: 14, lineHeight: 1.6,
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
              Отредактируйте описание выполненных работ. Сохраняется автоматически.
            </div>
          </div>
        )}

        {/* Показать саммари в read-only если уже submitted/approved */}
        {summaryText !== null && !isEditable && (
          <div className="cyber-card" style={{ marginBottom: 28 }}>
            <div style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'Orbitron, sans-serif', letterSpacing: 2, marginBottom: 10 }}>
              САММАРИ ВЫПОЛНЕННЫХ РАБОТ
            </div>
            <div style={{
              fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>
              {summaryText}
            </div>
          </div>
        )}

        {/* СЕКЦИЯ 1 — AI-оценка */}
        {binaryAuto.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div className="section-heading">
              <span style={{ fontSize: 18 }}>⚡</span>
              <span className="section-heading-text">AI-Оценка</span>
              <span className="section-heading-count">{binaryAuto.length}</span>
            </div>
            {/* Если AI ещё не оценивал — показать плейсхолдер */}
            {binaryAuto.every(k => k.score === null) && isEditable && (
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'rgba(0,229,255,0.04)',
                border: '1px solid rgba(0,229,255,0.15)',
                fontSize: 13, color: 'var(--text-dim)', marginBottom: 12,
              }}>
                AI оценит эти показатели автоматически в момент отправки отчёта.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {binaryAuto.map((item, i) => (
                <div key={i} className="cyber-card" style={{
                  '--accent-color': item.ai_low_confidence ? 'rgba(255,184,0,0.4)' : undefined,
                } as React.CSSProperties}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {item.indicator}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                        {item.criterion}
                      </div>
                      {item.summary && (
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
                          {item.summary}
                        </div>
                      )}
                      {item.score !== null && item.confidence !== null && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                            Уверенность AI: {item.confidence}%
                          </div>
                          <div style={{ width: 120, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                            <div style={{
                              width: `${item.confidence}%`, height: '100%', borderRadius: 2,
                              background: item.confidence >= 50 ? 'var(--accent3)' : 'var(--warn)',
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      {item.score !== null ? (
                        <span className={`badge ${item.score >= 100 ? 'badge-success' : 'badge-fail'}`}>
                          {item.score >= 100 ? '✅ Выполнено' : '❌ Не выполнено'}
                        </span>
                      ) : (
                        <span className="badge badge-dim">⏳ Ожидает AI</span>
                      )}
                      {item.ai_low_confidence && (
                        <span className="badge badge-warn" style={{ fontSize: 10 }}>⚠️ Низкая уверенность</span>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                    Вес: <strong style={{ color: 'var(--text)' }}>{item.weight}%</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* СЕКЦИЯ 2 — Числовые показатели */}
        {numeric.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div className="section-heading">
              <span style={{ fontSize: 18 }}>📊</span>
              <span className="section-heading-text">Числовые показатели</span>
              <span className="section-heading-count">{numeric.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {numeric.map((item, i) => (
                <NumericInput
                  key={i}
                  item={item}
                  disabled={!isEditable}
                  onUpdate={handleNumericUpdate}
                />
              ))}
            </div>
          </section>
        )}

        {/* СЕКЦИЯ 3 — Оценка руководителем */}
        {binaryManual.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div className="section-heading">
              <span style={{ fontSize: 18 }}>👤</span>
              <span className="section-heading-text">Оценка руководителем</span>
              <span className="section-heading-count">{binaryManual.length}</span>
            </div>
            <div style={{
              padding: '12px 16px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--card-border)', borderRadius: 10,
              fontSize: 13, color: 'var(--text-dim)', marginBottom: 12,
            }}>
              Следующие показатели будут оценены вашим непосредственным руководителем
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {binaryManual.map((item, i) => (
                <div
                  key={i}
                  className="cyber-card"
                  style={{ '--accent-color': 'rgba(232,234,246,0.2)' } as React.CSSProperties}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {item.indicator}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {item.criterion}
                      </div>
                      {item.cumulative && (
                        <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 3 }}>↗ нарастающим итогом</div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {item.score !== null ? (
                        <span className={`badge ${item.score >= 100 ? 'badge-success' : 'badge-fail'}`}>
                          {item.score >= 100 ? '✅ Выполнено' : '❌ Не выполнено'}
                        </span>
                      ) : (
                        <span className="badge badge-dim">⏳ Ожидает руководителя</span>
                      )}
                    </div>
                  </div>
                  {item.summary && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      {item.summary}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                    Вес: <strong style={{ color: 'var(--text)' }}>{item.weight}%</strong>
                    {item.is_common && <span className="badge badge-info" style={{ marginLeft: 8, fontSize: 10 }}>Общий</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PDF для утверждённых */}
        {submission.status === 'approved' && (
          <section style={{ marginTop: 8 }}>
            <button
              className="cyber-btn cyber-btn-primary"
              onClick={async () => {
                const token = localStorage.getItem('access_token')
                const res = await fetch(`/api/reports/${submissionId}/pdf`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                if (res.ok) {
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `KPI_${submission.period_name}.pdf`
                  a.click()
                  URL.revokeObjectURL(url)
                } else {
                  alert('Ошибка генерации PDF')
                }
              }}
            >
              📄 Скачать PDF-отчёт
            </button>
          </section>
        )}

      </div>
      </div>
    </>
  )
}
