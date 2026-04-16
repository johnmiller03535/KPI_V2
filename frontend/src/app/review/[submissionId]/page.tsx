'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type KpiValue = {
  indicator: string
  criterion: string
  weight: number
  plan_value: string | number
  fact_value?: string | number | null
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
  kpi_values: KpiValue[] | null
  submitted_at: string | null
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Ожидает проверки',
  approved:  'Утверждён',
  rejected:  'Возвращён на доработку',
  draft:     'Черновик',
}

export default function ReviewDetailPage({
  params,
}: {
  params: { submissionId: string }
}) {
  const { submissionId } = params
  const router = useRouter()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [deciding, setDeciding] = useState(false)

  useEffect(() => {
    api.get(`/review/submissions/${submissionId}`)
      .then(res => setSubmission(res.data))
      .catch(() => router.push('/review'))
      .finally(() => setLoading(false))
  }, [submissionId, router])

  async function handleDecide(approved: boolean) {
    if (!approved && !comment.trim()) {
      alert('Укажите причину возврата на доработку')
      return
    }
    if (!confirm(approved ? 'Утвердить отчёт?' : 'Вернуть на доработку?')) return
    setDeciding(true)
    try {
      await api.post(`/review/submissions/${submissionId}/decide`, {
        approved,
        comment: comment || null,
      })
      alert(approved ? 'Отчёт утверждён' : 'Отчёт возвращён на доработку')
      router.push('/review')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка при сохранении решения')
    } finally {
      setDeciding(false)
    }
  }

  const s: Record<string, any> = {
    page:     { padding: '2rem', fontFamily: 'sans-serif', maxWidth: '860px', margin: '0 auto' },
    card:     { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' },
    label:    { display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 500 },
    textBox:  { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.875rem', fontSize: '0.875rem', color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, minHeight: '60px' },
    textarea: { width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.875rem', minHeight: '80px', resize: 'vertical' as const, boxSizing: 'border-box' as const },
    btnGreen: { padding: '0.625rem 1.5rem', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 },
    btnRed:   { padding: '0.625rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 },
    h2:       { marginTop: 0, fontSize: '1.1rem', color: '#1e293b' },
  }

  if (loading) return <div style={s.page}><p style={{ color: '#64748b' }}>Загрузка...</p></div>
  if (!submission) return <div style={s.page}><p>Отчёт не найден</p></div>

  async function downloadPdf(label: string) {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`/api/reports/${submissionId}/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `KPI_${submission!.employee_full_name}_${submission!.period_name}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      alert('Ошибка генерации PDF')
    }
  }

  const canDecide = submission.status === 'submitted'

  return (
    <div style={s.page}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/review" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Проверка отчётов</a>
        <h1 style={{ margin: '0.5rem 0 0.25rem' }}>{submission.employee_full_name}</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>
          {submission.period_name}
          {submission.role_name && ` • ${submission.role_name}`}
          {submission.submitted_at && ` • ${new Date(submission.submitted_at).toLocaleDateString('ru-RU')}`}
          {' • '}
          <strong style={{
            color: submission.status === 'approved' ? '#22c55e'
                 : submission.status === 'rejected' ? '#ef4444'
                 : '#f59e0b',
          }}>
            {STATUS_LABELS[submission.status] || submission.status}
          </strong>
        </p>
      </div>

      {/* Бинарные KPI */}
      <div style={s.card}>
        <h2 style={s.h2}>Описание выполненных работ</h2>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={s.label}>Исполнительская дисциплина (30%)</label>
          <div style={s.textBox}>{submission.bin_discipline_summary || '—'}</div>
        </div>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={s.label}>Соблюдение трудового распорядка (10%)</label>
          <div style={s.textBox}>{submission.bin_schedule_summary || '—'}</div>
        </div>
        <div>
          <label style={s.label}>Охрана труда (10%)</label>
          <div style={s.textBox}>{submission.bin_safety_summary || '—'}</div>
        </div>
      </div>

      {/* Числовые KPI */}
      {submission.kpi_values && submission.kpi_values.length > 0 && (
        <div style={s.card}>
          <h2 style={s.h2}>Специфические показатели</h2>
          {submission.kpi_values.map((kpi, idx) => (
            <div key={idx} style={{
              borderBottom: idx < submission.kpi_values!.length - 1 ? '1px solid #f1f5f9' : 'none',
              paddingBottom: '1rem', marginBottom: idx < submission.kpi_values!.length - 1 ? '1rem' : 0,
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {kpi.criterion}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                {kpi.indicator} • Вес: {kpi.weight}% • План: {kpi.plan_value}
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Факт: </span>
                <strong>{kpi.fact_value ?? '—'}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Решение */}
      {canDecide ? (
        <div style={s.card}>
          <h2 style={s.h2}>Решение</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label style={s.label}>Комментарий (обязателен при возврате)</label>
            <textarea
              style={s.textarea}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Укажите замечания или комментарий..."
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button style={{ ...s.btnGreen, opacity: deciding ? 0.6 : 1 }} onClick={() => handleDecide(true)} disabled={deciding}>
              Утвердить
            </button>
            <button style={{ ...s.btnRed, opacity: deciding ? 0.6 : 1 }} onClick={() => handleDecide(false)} disabled={deciding}>
              Вернуть на доработку
            </button>
            <button
              onClick={() => downloadPdf('preview')}
              style={{
                padding: '0.625rem 1.25rem',
                background: '#64748b', color: 'white', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              📄 Предпросмотр PDF
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Статус: <strong>{STATUS_LABELS[submission.status] || submission.status}</strong>
          </span>
          {submission.status === 'approved' && (
            <button
              onClick={() => downloadPdf('download')}
              style={{
                padding: '0.5rem 1rem', background: '#7c3aed', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: 600,
              }}
            >
              📄 Скачать PDF
            </button>
          )}
        </div>
      )}
    </div>
  )
}
