'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { NavBar } from '@/components/NavBar'

// ─── Типы ────────────────────────────────────────────────────────────────────

type KpiItem = {
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
  fact_value: number | null
  parsed_thresholds: any[] | null
  requires_review: boolean
  reviewer_comment?: string
  reviewed_at?: string
  plan_value?: string | number
  manager_override?: boolean | null
}

type Submission = {
  id: string
  employee_full_name: string
  employee_login: string
  period_name: string
  role_name: string | null
  position_id: string | null
  status: string
  bin_discipline_summary: string | null
  bin_schedule_summary: string | null
  bin_safety_summary: string | null
  kpi_values: KpiItem[] | null
  submitted_at: string | null
  ai_generated_at: string | null
}

// ─── Константы ───────────────────────────────────────────────────────────────

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

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function effectiveScore(item: KpiItem): number | null {
  if (item.formula_type === 'binary_auto' && item.manager_override !== undefined && item.manager_override !== null) {
    return item.manager_override ? 100 : 0
  }
  return item.score
}

function computeScore(kpiValues: KpiItem[] | null): number | null {
  if (!kpiValues || kpiValues.length === 0) return null
  const scored = kpiValues.filter(k => effectiveScore(k) !== null)
  if (scored.length === 0) return null
  const sw = scored.reduce((s, k) => s + k.weight, 0)
  if (sw === 0) return null
  return Math.round(scored.reduce((s, k) => s + (effectiveScore(k) ?? 0) * k.weight, 0) / sw)
}

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-dim)'
  if (score >= 90) return 'var(--accent3)'
  if (score >= 70) return 'var(--warn)'
  return 'var(--danger)'
}

function pendingCount(kpiValues: KpiItem[] | null): number {
  if (!kpiValues) return 0
  return kpiValues.filter(k => k.formula_type === 'binary_manual' && k.awaiting_manual_input).length
}

// ─── Компонент: карточка binary_auto (с кнопками override) ──────────────────

function BinaryAutoCard({
  item,
  globalIndex,
  submissionId,
  submissionStatus,
  onOverride,
}: {
  item: KpiItem
  globalIndex: number
  submissionId: string
  submissionStatus: string
  onOverride: (globalIndex: number, value: boolean | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const canEdit = submissionStatus === 'submitted'

  const aiScore = item.score
  const override = item.manager_override ?? null
  // Отображаемый score: override имеет приоритет
  const displayScore = override !== null ? (override ? 100 : 0) : aiScore
  const overridesDiffers = override !== null && aiScore !== null && ((override ? 100 : 0) !== aiScore)

  const accent = displayScore === null ? 'var(--text-dim)'
    : displayScore >= 90 ? 'var(--accent3)'
    : displayScore >= 70 ? 'var(--warn)'
    : 'var(--danger)'

  async function handleOverride(value: boolean | null) {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      await api.patch(`/review/${submissionId}/binary-auto-override`, {
        kpi_index: globalIndex,
        manager_override: value,
      })
      onOverride(globalIndex, value)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="cyber-card"
      style={{ '--accent-color': accent } as React.CSSProperties}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            {item.is_common && <span className="badge badge-dim" style={{ fontSize: 10 }}>Общий</span>}
            {item.requires_review && <span className="badge badge-warn" style={{ fontSize: 10 }}>Требует внимания</span>}
            {override !== null && <span className="badge badge-warn" style={{ fontSize: 10 }}>Переопределено</span>}
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.weight}%</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--text)' }}>
            {item.criterion}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: item.summary ? 10 : 0 }}>
            {item.indicator}
          </div>
          {item.summary && (
            <div style={{
              background: 'rgba(0,229,255,0.04)',
              border: '1px solid rgba(0,229,255,0.1)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              color: 'var(--text)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {item.summary}
            </div>
          )}
          {item.confidence !== null && item.confidence !== undefined && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                Уверенность AI: {item.confidence}%
              </div>
              <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, maxWidth: 120 }}>
                <div style={{ width: `${item.confidence}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
              </div>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {displayScore !== null ? (
            <>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>
                {Math.round(displayScore)}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                {override !== null ? 'решение рук-ля' : 'оценка AI'}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-dim)' }}>—</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>нет оценки</div>
            </>
          )}
        </div>
      </div>

      {/* Блок override — только в статусе submitted */}
      {canEdit && (
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 8 }}>
            РЕШЕНИЕ РУКОВОДИТЕЛЯ (переопределяет AI)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleOverride(override === true ? null : true)}
              disabled={saving}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                border: `1px solid ${override === true ? '#00ff9d' : 'rgba(0,255,157,0.25)'}`,
                background: override === true ? 'rgba(0,255,157,0.15)' : 'transparent',
                color: override === true ? '#00ff9d' : 'rgba(0,255,157,0.5)',
                fontSize: 12, fontWeight: 700, fontFamily: 'Exo 2, sans-serif',
                transition: 'all 0.2s', opacity: saving ? 0.6 : 1,
              }}
            >
              ✅ Подтвердить выполнение
            </button>
            <button
              onClick={() => handleOverride(override === false ? null : false)}
              disabled={saving}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                border: `1px solid ${override === false ? '#ff3b5c' : 'rgba(255,59,92,0.25)'}`,
                background: override === false ? 'rgba(255,59,92,0.15)' : 'transparent',
                color: override === false ? '#ff3b5c' : 'rgba(255,59,92,0.5)',
                fontSize: 12, fontWeight: 700, fontFamily: 'Exo 2, sans-serif',
                transition: 'all 0.2s', opacity: saving ? 0.6 : 1,
              }}
            >
              ❌ Не выполнено
            </button>
          </div>
          {overridesDiffers && (
            <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 7 }}>
              ⚠️ Решение руководителя отличается от оценки AI
            </div>
          )}
          {override !== null && (
            <button
              onClick={() => handleOverride(null)}
              disabled={saving}
              style={{
                marginTop: 6, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'Exo 2, sans-serif',
              }}
            >
              × Сбросить (вернуть AI-оценку)
            </button>
          )}
        </div>
      )}

      {/* Статус override — режим просмотра */}
      {!canEdit && override !== null && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--warn)' }}>
          ⚠️ Руководитель переопределил AI: {override ? '✅ Выполнено' : '❌ Не выполнено'}
        </div>
      )}
    </div>
  )
}

// ─── Компонент: карточка numeric ─────────────────────────────────────────────

function NumericCard({ item }: { item: KpiItem }) {
  const sc = item.score
  const accent = sc === null ? 'rgba(0,229,255,0.2)' : sc >= 90 ? 'var(--accent3)' : sc >= 70 ? 'var(--warn)' : 'var(--danger)'

  return (
    <div
      className="cyber-card"
      style={{ '--accent-color': accent } as React.CSSProperties}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {item.is_common && <span className="badge badge-dim" style={{ fontSize: 10 }}>Общий</span>}
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.weight}%</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, color: 'var(--text)' }}>
            {item.criterion}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
            {item.indicator}
            {item.formula_type && ` · ${item.formula_type}`}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ПЛАН</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {item.plan_value ?? '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ФАКТ</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: item.fact_value !== null ? 'var(--accent)' : 'var(--text-dim)' }}>
                {item.fact_value !== null && item.fact_value !== undefined ? item.fact_value : '—'}
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {sc !== null ? (
            <>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>
                {Math.round(sc)}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>выполнение</div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-dim)' }}>—</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>нет факта</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Компонент: карточка binary_manual (интерактивная) ────────────────────────

function BinaryManualCard({
  item,
  index,
  submissionId,
  submissionStatus,
  onScored,
}: {
  item: KpiItem
  index: number
  submissionId: string
  submissionStatus: string
  onScored: (index: number, score: number, comment: string) => void
}) {
  const [localScore, setLocalScore] = useState<number | null>(item.score ?? null)
  const [comment, setComment] = useState(item.reviewer_comment || '')
  const [saving, setSaving] = useState(false)

  const canEdit = submissionStatus === 'submitted'

  async function handleScore(score: number) {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      await api.patch(`/review/${submissionId}/binary-manual`, {
        kpi_index: index,
        score,
        comment: comment || '',
      })
      setLocalScore(score)
      onScored(index, score, comment)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка при сохранении оценки')
    } finally {
      setSaving(false)
    }
  }

  const accent = localScore === null ? 'rgba(0,229,255,0.15)'
    : localScore === 100 ? 'var(--accent3)'
    : 'var(--danger)'

  return (
    <div
      className="cyber-card"
      style={{ '--accent-color': accent } as React.CSSProperties}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        {item.is_common && <span className="badge badge-dim" style={{ fontSize: 10 }}>Общий</span>}
        {localScore === null && canEdit && (
          <span className="badge badge-warn" style={{ fontSize: 10 }}>Требует оценки</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.weight}%</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--text)' }}>
        {item.criterion}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14 }}>
        {item.indicator}
      </div>

      {/* Кнопки оценки */}
      {canEdit && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button
              onClick={() => handleScore(100)}
              disabled={saving}
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 10,
                border: `2px solid ${localScore === 100 ? 'var(--accent3)' : 'rgba(0,255,157,0.2)'}`,
                background: localScore === 100 ? 'rgba(0,255,157,0.15)' : 'rgba(0,255,157,0.04)',
                color: localScore === 100 ? 'var(--accent3)' : 'rgba(0,255,157,0.6)',
                cursor: saving ? 'wait' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'Exo 2, sans-serif',
                transition: 'all 0.2s',
                opacity: saving ? 0.7 : 1,
              }}
            >
              ✅ ВЫПОЛНЕНО
            </button>
            <button
              onClick={() => handleScore(0)}
              disabled={saving}
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 10,
                border: `2px solid ${localScore === 0 ? 'var(--danger)' : 'rgba(255,59,92,0.2)'}`,
                background: localScore === 0 ? 'rgba(255,59,92,0.15)' : 'rgba(255,59,92,0.04)',
                color: localScore === 0 ? 'var(--danger)' : 'rgba(255,59,92,0.6)',
                cursor: saving ? 'wait' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'Exo 2, sans-serif',
                transition: 'all 0.2s',
                opacity: saving ? 0.7 : 1,
              }}
            >
              ❌ НЕ ВЫПОЛНЕНО
            </button>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Комментарий (необязательно)</div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Пояснение к оценке..."
              rows={2}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 12,
                fontFamily: 'Exo 2, sans-serif',
                padding: '8px 10px',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
        </>
      )}

      {/* Статус (только просмотр) */}
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {localScore === 100 && <span style={{ color: 'var(--accent3)', fontWeight: 700, fontSize: 14 }}>✅ ВЫПОЛНЕНО</span>}
          {localScore === 0 && <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 14 }}>❌ НЕ ВЫПОЛНЕНО</span>}
          {localScore === null && <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>— Не оценено</span>}
          {item.reviewer_comment && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>· {item.reviewer_comment}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Модальное окно отклонения ────────────────────────────────────────────────

function RejectModal({
  onConfirm,
  onClose,
  submitting,
}: {
  onConfirm: (reason: string) => void
  onClose: () => void
  submitting: boolean
}) {
  const [reason, setReason] = useState('')
  const canSubmit = reason.trim().length >= 10

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(6,6,15,0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid rgba(255,59,92,0.3)',
        borderRadius: 16,
        padding: 28,
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 0 40px rgba(255,59,92,0.15)',
      }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 900, letterSpacing: 2, color: 'var(--danger)', marginBottom: 8 }}>
          ОТКЛОНЕНИЕ ОТЧЁТА
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
          Укажите причину возврата на доработку
        </div>
        <textarea
          autoFocus
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Опишите замечания (минимум 10 символов)..."
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${canSubmit ? 'rgba(255,59,92,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10,
            color: 'var(--text)',
            fontSize: 13,
            fontFamily: 'Exo 2, sans-serif',
            padding: '10px 12px',
            resize: 'vertical',
            outline: 'none',
            marginBottom: 6,
          }}
        />
        <div style={{ fontSize: 11, color: reason.trim().length < 10 ? 'var(--text-dim)' : 'var(--accent3)', marginBottom: 20 }}>
          {reason.trim().length} / 10 символов минимум
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!canSubmit || submitting}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 8,
              border: 'none',
              background: canSubmit && !submitting ? 'var(--danger)' : 'rgba(255,59,92,0.2)',
              color: canSubmit && !submitting ? '#fff' : 'rgba(255,59,92,0.4)',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: 'Exo 2, sans-serif',
              cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            {submitting ? 'Отправка...' : 'Подтвердить'}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="cyber-btn"
            style={{ padding: '11px 20px', fontSize: 13 }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function ReviewDetailPage({
  params,
}: {
  params: { submissionId: string }
}) {
  const { submissionId } = params
  const router = useRouter()

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/login'); return }
    api.get(`/review/submissions/${submissionId}`)
      .then(res => setSubmission(res.data))
      .catch(() => router.push('/review'))
      .finally(() => setLoading(false))
  }, [submissionId, router])

  // Обновить оценку binary_manual в локальном state
  const handleManualScored = useCallback((index: number, score: number, comment: string) => {
    setSubmission(prev => {
      if (!prev?.kpi_values) return prev
      const updated = prev.kpi_values.map((item, i) => {
        if (i !== index) return item
        return { ...item, score, awaiting_manual_input: false, reviewer_comment: comment }
      })
      return { ...prev, kpi_values: updated }
    })
  }, [])

  // Обновить manager_override для binary_auto в локальном state
  const handleAutoOverride = useCallback((globalIndex: number, value: boolean | null) => {
    setSubmission(prev => {
      if (!prev?.kpi_values) return prev
      const updated = prev.kpi_values.map((item, i) => {
        if (i !== globalIndex) return item
        return { ...item, manager_override: value }
      })
      return { ...prev, kpi_values: updated }
    })
  }, [])

  async function handleDecide(approved: boolean, rejectReason?: string) {
    setDeciding(true)
    try {
      await api.post(`/review/submissions/${submissionId}/decide`, {
        approved,
        comment: rejectReason || null,
      })
      setShowRejectModal(false)
      router.push('/review')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка при принятии решения')
    } finally {
      setDeciding(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loader-ring" style={{ margin: '0 auto' }} />
          <p className="loader-text" style={{ marginTop: 16 }}>ЗАГРУЗКА...</p>
        </div>
      </div>
    )
  }

  if (!submission) {
    return (
      <div style={{ maxWidth: 720, margin: '60px auto', textAlign: 'center', color: 'var(--text-dim)' }}>
        Отчёт не найден
      </div>
    )
  }

  const kpiValues = submission.kpi_values || []
  // Фильтрация строго по formula_type — is_common не влияет на блок
  const _NUMERIC_TYPES = ['threshold', 'multi_threshold', 'quarterly_threshold']

  // Пары [item, globalIndex] для каждой группы
  const binaryAutoIndexed  = kpiValues.map((k, i) => [k, i] as [KpiItem, number]).filter(([k]) => k.formula_type === 'binary_auto')
  const binaryManualIndexed = kpiValues.map((k, i) => [k, i] as [KpiItem, number]).filter(([k]) => k.formula_type === 'binary_manual')
  const numericIndexed      = kpiValues.map((k, i) => [k, i] as [KpiItem, number]).filter(([k]) => _NUMERIC_TYPES.includes(k.formula_type))

  const binaryAuto   = binaryAutoIndexed.map(([k]) => k)
  const binaryManual = binaryManualIndexed.map(([k]) => k)
  const numericItems = numericIndexed.map(([k]) => k)

  const score = computeScore(kpiValues)
  const pending = pendingCount(submission.kpi_values)
  const canDecide = submission.status === 'submitted'
  const canApprove = canDecide && pending === 0

  return (
    <>
      {showRejectModal && (
        <RejectModal
          onConfirm={reason => handleDecide(false, reason)}
          onClose={() => setShowRejectModal(false)}
          submitting={deciding}
        />
      )}

      <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <NavBar />

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <a href="/dashboard">KPI ПОРТАЛ</a>
        <span className="breadcrumb-sep">›</span>
        <a href="/review">Проверка отчётов</a>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{submission.employee_full_name}</span>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 24px 40px', position: 'relative', zIndex: 1 }}>

        {/* Хедер */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 900, letterSpacing: 3, color: 'var(--accent)', marginBottom: 6, textShadow: 'var(--glow)' }}>
            KPI ПОРТАЛ
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {submission.employee_full_name}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                <span>{submission.period_name}</span>
                {submission.role_name && <span>· {submission.role_name}</span>}
                {submission.submitted_at && (
                  <span>· {new Date(submission.submitted_at).toLocaleDateString('ru-RU')}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`badge ${STATUS_CLASS[submission.status] || 'badge-dim'}`} style={{ fontSize: 12 }}>
                {STATUS_LABEL[submission.status] || submission.status}
              </span>
              {score !== null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 700, color: scoreColor(score), lineHeight: 1 }}>
                    {score}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>итоговая оценка</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert-banner */}
        {canDecide && pending > 0 && (
          <div className="alert-banner alert-warn">
            <span style={{ fontSize: 18 }}>⚠</span>
            <span>Необходимо оценить <strong>{pending}</strong> {pending === 1 ? 'показатель' : pending < 5 ? 'показателя' : 'показателей'} вручную перед утверждением</span>
          </div>
        )}
        {canDecide && pending === 0 && kpiValues.length > 0 && (
          <div className="alert-banner alert-success">
            <span style={{ fontSize: 18 }}>✅</span>
            <span>Все показатели оценены. Можно утвердить отчёт.</span>
          </div>
        )}

        {/* ─── Секция 1: AI-оценённые KPI ─────────────────────────────────────── */}
        {binaryAutoIndexed.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div className="cyber-title" style={{ marginBottom: 14 }}>
              🤖 AI-ОЦЕНКА · {binaryAutoIndexed.length} ПОКАЗАТЕЛЕЙ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {binaryAutoIndexed.map(([item, globalIdx]) => (
                <BinaryAutoCard
                  key={globalIdx}
                  item={item}
                  globalIndex={globalIdx}
                  submissionId={submissionId}
                  submissionStatus={submission.status}
                  onOverride={handleAutoOverride}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Секция 2: Числовые KPI ──────────────────────────────────────────── */}
        {numericIndexed.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div className="cyber-title" style={{ marginBottom: 14 }}>
              📊 ЧИСЛОВЫЕ ПОКАЗАТЕЛИ · {numericIndexed.length} ПОКАЗАТЕЛЕЙ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {numericIndexed.map(([item, globalIdx]) => (
                <NumericCard key={globalIdx} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* ─── Секция 3: Ручная оценка ─────────────────────────────────────────── */}
        {binaryManualIndexed.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div className="cyber-title" style={{ marginBottom: 14 }}>
              ✋ РУЧНАЯ ОЦЕНКА · {binaryManualIndexed.length} ПОКАЗАТЕЛЕЙ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {binaryManualIndexed.map(([item, globalIdx]) => (
                <BinaryManualCard
                  key={globalIdx}
                  item={item}
                  index={globalIdx}
                  submissionId={submissionId}
                  submissionStatus={submission.status}
                  onScored={handleManualScored}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Секция 4: Без новой структуры (legacy binary поля) ──────────────── */}
        {kpiValues.length === 0 && (
          submission.bin_discipline_summary || submission.bin_schedule_summary || submission.bin_safety_summary
        ) && (
          <div style={{ marginBottom: 32 }}>
            <div className="cyber-title" style={{ marginBottom: 14 }}>
              📋 ОПИСАНИЕ ВЫПОЛНЕННЫХ РАБОТ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Исполнительская дисциплина (30%)', value: submission.bin_discipline_summary },
                { label: 'Соблюдение трудового распорядка (10%)', value: submission.bin_schedule_summary },
                { label: 'Охрана труда (10%)', value: submission.bin_safety_summary },
              ].filter(x => x.value).map((x, i) => (
                <div key={i} className="cyber-card" style={{ '--accent-color': 'rgba(0,229,255,0.2)' } as React.CSSProperties}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>{x.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {x.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Панель решения ──────────────────────────────────────────────────── */}
        {canDecide ? (
          <div style={{
            padding: '20px 24px',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={() => handleDecide(true)}
              disabled={!canApprove || deciding}
              title={!canApprove ? `Необходимо оценить ${pending} показателей` : undefined}
              style={{
                padding: '11px 24px',
                borderRadius: 10,
                border: 'none',
                background: canApprove && !deciding
                  ? 'linear-gradient(135deg, rgba(0,255,157,0.3), rgba(0,255,157,0.1))'
                  : 'rgba(0,255,157,0.06)',
                color: canApprove && !deciding ? 'var(--accent3)' : 'rgba(0,255,157,0.3)',
                fontWeight: 700,
                fontSize: 14,
                fontFamily: 'Exo 2, sans-serif',
                cursor: canApprove && !deciding ? 'pointer' : 'not-allowed',
                border: `1px solid ${canApprove ? 'rgba(0,255,157,0.4)' : 'rgba(0,255,157,0.1)'}`,
                transition: 'all 0.2s',
              } as React.CSSProperties}
            >
              {deciding ? 'Сохранение...' : '✅ Утвердить'}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={deciding}
              style={{
                padding: '11px 24px',
                borderRadius: 10,
                border: '1px solid rgba(255,59,92,0.4)',
                background: 'rgba(255,59,92,0.08)',
                color: 'var(--danger)',
                fontWeight: 700,
                fontSize: 14,
                fontFamily: 'Exo 2, sans-serif',
                cursor: deciding ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: deciding ? 0.6 : 1,
              }}
            >
              ❌ Отклонить
            </button>
            <a
              href={`/api/reports/${submissionId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '11px 20px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-dim)',
                fontWeight: 600,
                fontSize: 13,
                fontFamily: 'Exo 2, sans-serif',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📄 Предпросмотр PDF
            </a>
          </div>
        ) : submission.status === 'approved' ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              border: '1px solid rgba(0,255,157,0.2)',
              background: 'rgba(0,255,157,0.06)',
              color: 'var(--accent3)', fontSize: 13, fontWeight: 600,
            }}>
              ✅ Отчёт утверждён
            </div>
            <a
              href={`/api/reports/${submissionId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="cyber-btn cyber-btn-primary"
              style={{ textDecoration: 'none', padding: '11px 20px', fontSize: 13 }}
            >
              📄 Скачать PDF
            </a>
          </div>
        ) : submission.status === 'rejected' ? (
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            border: '1px solid rgba(255,59,92,0.2)',
            background: 'rgba(255,59,92,0.06)',
            color: 'var(--danger)', fontSize: 13, fontWeight: 600,
          }}>
            ❌ Отчёт возвращён на доработку
          </div>
        ) : null}

      </div>
      </div>
    </>
  )
}
