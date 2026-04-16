'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type Submission = {
  id: string
  period_name: string
  position_id: string | null
  status: string
  bin_discipline_summary: string | null
  bin_schedule_summary: string | null
  bin_safety_summary: string | null
  kpi_values: any[] | null
  ai_generated_at: string | null
  reviewer_comment: string | null
}

type KpiStructure = {
  position_id: string | null
  role_info: { role: string; unit: string } | null
  kpi_items: Array<{
    indicator: string
    criterion: string
    weight: number
    formula_type: string
    plan_value: string
  }>
  numeric_kpis: Array<{
    indicator: string
    criterion: string
    weight: number
    formula_type: string
    plan_value: string
  }>
  binary_auto_criteria: string[]
}

type AISummary = {
  criteria: Record<string, string>
  general_summary: string
  discipline_summary: string
  time_entries_count: number
} | null

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  submitted: 'На проверке',
  approved: 'Утверждён',
  rejected: 'Возвращён на доработку',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#dbeafe', color: '#1d4ed8' },
  submitted: { bg: '#fef9c3', color: '#92400e' },
  approved:  { bg: '#dcfce7', color: '#166534' },
  rejected:  { bg: '#fee2e2', color: '#991b1b' },
}

export default function KpiFormPage({ params }: { params: { submissionId: string } }) {
  const { submissionId } = params
  const router = useRouter()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [structure, setStructure] = useState<KpiStructure | null>(null)
  const [aiSummary, setAiSummary] = useState<AISummary>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [discipline, setDiscipline] = useState('')
  const [schedule, setSchedule] = useState('')
  const [safety, setSafety] = useState('')
  const [numericValues, setNumericValues] = useState<Record<string, { fact: string; base: string }>>({})

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    loadData()
  }, [submissionId])

  async function loadData() {
    try {
      const [subRes, structRes] = await Promise.all([
        api.get(`/submissions/my/${submissionId}`),
        api.get(`/submissions/my/${submissionId}/kpi-structure`),
      ])
      const sub = subRes.data
      setSubmission(sub)
      setStructure(structRes.data)
      setDiscipline(sub.bin_discipline_summary || '')
      setSchedule(sub.bin_schedule_summary || '')
      setSafety(sub.bin_safety_summary || '')

      if (sub.kpi_values) {
        const vals: Record<string, { fact: string; base: string }> = {}
        sub.kpi_values.forEach((v: any) => {
          vals[v.criterion] = {
            fact: v.fact_value?.toString() || '',
            base: v.base_value?.toString() || '',
          }
        })
        setNumericValues(vals)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateAI() {
    setGenerating(true)
    setSaveMsg(null)
    try {
      const res = await api.post(`/submissions/my/${submissionId}/generate-summary`)
      setAiSummary(res.data)
      if (res.data.discipline_summary && !discipline) {
        setDiscipline(res.data.discipline_summary)
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка генерации AI-саммари')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const kpiValues = structure?.numeric_kpis.map(kpi => ({
        role_id: structure.position_id || '',
        indicator: kpi.indicator,
        criterion: kpi.criterion,
        formula_type: kpi.formula_type,
        weight: kpi.weight,
        plan_value: kpi.plan_value,
        fact_value: parseFloat(numericValues[kpi.criterion]?.fact || '') || null,
        base_value: parseFloat(numericValues[kpi.criterion]?.base || '') || null,
      })) || []

      await api.patch(`/submissions/my/${submissionId}`, {
        bin_discipline_summary: discipline,
        bin_schedule_summary: schedule,
        bin_safety_summary: safety,
        kpi_values: kpiValues,
      })
      setSaveMsg('Черновик сохранён')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!confirm('Отправить отчёт на проверку руководителю?\nПосле отправки редактирование будет недоступно.')) return
    setSubmitting(true)
    try {
      await api.patch(`/submissions/my/${submissionId}`, {
        bin_discipline_summary: discipline,
        bin_schedule_summary: schedule,
        bin_safety_summary: safety,
      })
      await api.post(`/submissions/my/${submissionId}/submit`)
      router.push('/dashboard')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  async function downloadPdf() {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`/api/reports/${submissionId}/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `KPI_${submission!.period_name}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      alert('Ошибка генерации PDF')
    }
  }

  const isEditable = submission?.status === 'draft' || submission?.status === 'rejected'
  const statusStyle = STATUS_COLORS[submission?.status || 'draft']

  const s: Record<string, any> = {
    page:     { padding: '2rem', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' },
    card:     { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' },
    label:    { display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 500 },
    textarea: { width: '100%', padding: '0.625rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.875rem', minHeight: '100px', resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'sans-serif' },
    input:    { width: '130px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.875rem' },
    btn:      { padding: '0.625rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    btnGray:  { padding: '0.625rem 1.25rem', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    btnGreen: { padding: '0.625rem 1.25rem', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    btnAI:    { padding: '0.625rem 1.25rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    h2:       { marginTop: 0, fontSize: '1.1rem', color: '#1e293b' },
    aiBox:    { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.875rem', marginBottom: '0.75rem', fontSize: '0.875rem', color: '#334155' },
    divider:  { borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1rem' },
  }

  if (loading) return <div style={s.page}><p style={{ color: '#64748b' }}>Загрузка...</p></div>
  if (!submission) return <div style={s.page}><p>Отчёт не найден</p></div>

  return (
    <div style={s.page}>
      {/* Заголовок */}
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Дашборд</a>
        <h1 style={{ margin: '0.5rem 0 0.25rem' }}>KPI-отчёт: {submission.period_name}</h1>
        {structure?.role_info && (
          <p style={{ color: '#64748b', margin: '0 0 0.5rem', fontSize: '0.875rem' }}>
            {structure.role_info.role} &bull; {structure.role_info.unit}
          </p>
        )}
        <span style={{
          display: 'inline-block', padding: '0.2rem 0.75rem',
          background: statusStyle.bg, color: statusStyle.color,
          borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
        }}>
          {STATUS_LABELS[submission.status] || submission.status}
        </span>
        {submission.reviewer_comment && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '6px', fontSize: '0.875rem' }}>
            <strong>Комментарий руководителя:</strong> {submission.reviewer_comment}
          </div>
        )}
      </div>

      {/* Секция AI-саммари */}
      <div style={s.card}>
        <h2 style={s.h2}>Описание выполненных работ</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 0 }}>
          Нажмите «Сформировать через AI», чтобы автоматически заполнить описание
          на основе ваших трудозатрат из Redmine. Текст можно отредактировать.
        </p>

        {isEditable && (
          <button style={s.btnAI} onClick={handleGenerateAI} disabled={generating}>
            {generating ? '⏳ Генерация...' : '✨ Сформировать через AI'}
          </button>
        )}

        {aiSummary && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#6d28d9', fontWeight: 600 }}>
              Обработано трудозатрат: {aiSummary.time_entries_count}
            </p>
            {Object.entries(aiSummary.criteria).map(([criterion, text]) => (
              <div key={criterion} style={s.aiBox}>
                <strong style={{ fontSize: '0.8rem' }}>{criterion}</strong>
                <p style={{ margin: '0.25rem 0 0' }}>{text}</p>
              </div>
            ))}
            {aiSummary.general_summary && (
              <div style={{ ...s.aiBox, background: '#eff6ff', borderColor: '#bfdbfe' }}>
                <strong style={{ fontSize: '0.8rem' }}>Общее описание:</strong>
                <p style={{ margin: '0.25rem 0 0' }}>{aiSummary.general_summary}</p>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '1.25rem' }}>
          <label style={s.label}>Исполнительская дисциплина (30%)</label>
          <textarea
            style={{ ...s.textarea, ...(isEditable ? {} : { background: '#f8fafc', color: '#64748b' }) }}
            value={discipline}
            onChange={e => setDiscipline(e.target.value)}
            disabled={!isEditable}
            placeholder="Описание соблюдения исполнительской дисциплины..."
          />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={s.label}>Соблюдение трудового распорядка (10%)</label>
          <textarea
            style={{ ...s.textarea, ...(isEditable ? {} : { background: '#f8fafc', color: '#64748b' }) }}
            value={schedule}
            onChange={e => setSchedule(e.target.value)}
            disabled={!isEditable}
            placeholder="Описание соблюдения трудового распорядка..."
          />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={s.label}>Охрана труда (10%)</label>
          <textarea
            style={{ ...s.textarea, ...(isEditable ? {} : { background: '#f8fafc', color: '#64748b' }) }}
            value={safety}
            onChange={e => setSafety(e.target.value)}
            disabled={!isEditable}
            placeholder="Описание выполнения требований охраны труда..."
          />
        </div>
      </div>

      {/* Числовые KPI */}
      {structure?.numeric_kpis && structure.numeric_kpis.length > 0 && (
        <div style={s.card}>
          <h2 style={s.h2}>Специфические показатели (ввод вручную)</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 0 }}>
            Введите фактические значения по каждому показателю.
            Плановый порог выполнения указан в скобках.
          </p>
          {structure.numeric_kpis.map((kpi, idx) => (
            <div key={idx} style={{ ...s.divider, ...(idx === structure.numeric_kpis.length - 1 ? { borderBottom: 'none', paddingBottom: 0, marginBottom: 0 } : {}) }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                {kpi.criterion}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Порог: <strong>{kpi.formula_type}</strong> &nbsp;&bull;&nbsp; План: {kpi.plan_value}
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ ...s.label, marginBottom: '0.2rem' }}>Факт</label>
                  <input
                    type="number"
                    style={s.input}
                    value={numericValues[kpi.criterion]?.fact || ''}
                    onChange={e => setNumericValues(prev => ({
                      ...prev,
                      [kpi.criterion]: { ...prev[kpi.criterion], fact: e.target.value },
                    }))}
                    disabled={!isEditable}
                    placeholder="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Кнопки */}
      {isEditable && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={s.btnGray} onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : '💾 Сохранить черновик'}
          </button>
          <button style={s.btnGreen} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Отправка...' : '📤 Отправить на проверку'}
          </button>
          {saveMsg && (
            <span style={{ fontSize: '0.875rem', color: '#166534' }}>✓ {saveMsg}</span>
          )}
        </div>
      )}

      {/* Скачать PDF — только для утверждённых отчётов */}
      {submission?.status === 'approved' && (
        <div style={{ marginTop: '1.5rem' }}>
          <button
            onClick={downloadPdf}
            style={{
              padding: '0.625rem 1.25rem',
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            📄 Скачать PDF-отчёт
          </button>
        </div>
      )}
    </div>
  )
}
