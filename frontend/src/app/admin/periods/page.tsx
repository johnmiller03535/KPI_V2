'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

// ─── Типы ─────────────────────────────────────────────────────────────────────

type Period = {
  id: string
  name: string
  period_type: string
  year: number
  date_start: string
  date_end: string
  submit_deadline: string
  review_deadline: string
  status: string
  redmine_tasks_created: boolean
  redmine_tasks_count: number
  created_by: string
  created_at: string
}

// ─── Хелперы ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик', active: 'Активен', review: 'На проверке', closed: 'Закрыт',
}
const STATUS_BADGE: Record<string, string> = {
  draft:  'badge badge-warn',
  active: 'badge badge-success',
  review: 'badge badge-warn',
  closed: 'badge badge-dim',
}
const STATUS_ACCENT: Record<string, string> = {
  draft: 'var(--warn)', active: 'var(--accent3)', review: 'var(--warn)', closed: 'var(--text-dim)',
}

const INPUT: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
  padding: '9px 12px', color: 'var(--text)',
  fontSize: 13, fontFamily: 'Exo 2, sans-serif',
  outline: 'none', boxSizing: 'border-box',
}
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700,
  letterSpacing: '2px', textTransform: 'uppercase',
  color: 'var(--text-dim)', marginBottom: 6,
  fontFamily: 'Exo 2, sans-serif',
}

// ─── Страница ─────────────────────────────────────────────────────────────────

export default function PeriodsPage() {
  const router = useRouter()
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [taskResult, setTaskResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Period | null>(null)
  const [deleting, setDeleting] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    period_type: 'monthly',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    quarter: 1,
    name: '',
    date_start: today,
    date_end: today,
    submit_deadline: today,
    review_deadline: today,
  })

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (!user) { router.push('/login'); return }
    const u = JSON.parse(user)
    if (u.role !== 'admin') { router.push('/dashboard'); return }
    loadPeriods()
  }, [])

  async function loadPeriods() {
    setLoading(true)
    try {
      const res = await api.get('/periods')
      setPeriods(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const payload: any = {
        period_type: form.period_type,
        year: form.year,
        name: form.name,
        date_start: form.date_start,
        date_end: form.date_end,
        submit_deadline: form.submit_deadline,
        review_deadline: form.review_deadline,
      }
      if (form.period_type === 'monthly') payload.month = form.month
      if (form.period_type === 'quarterly') payload.quarter = form.quarter
      await api.post('/periods', payload)
      setShowForm(false)
      await loadPeriods()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка создания периода')
    } finally { setCreating(false) }
  }

  async function handleDryRun(periodId: string) {
    try {
      const res = await api.post(`/periods/${periodId}/create-tasks?dry_run=true`)
      setTaskResult({ ok: true, text: `Dry-run: будет создано ${res.data.created} задач, пропущено ${res.data.skipped}` })
    } catch (err: any) {
      setTaskResult({ ok: false, text: err.response?.data?.detail || 'Ошибка' })
    }
  }

  async function handleCreateTasks(periodId: string) {
    if (!confirm('Создать задачи в Redmine для всех сотрудников? Это действие нельзя отменить.')) return
    try {
      const res = await api.post(`/periods/${periodId}/create-tasks`)
      setTaskResult({ ok: true, text: `Создано: ${res.data.created}, пропущено: ${res.data.skipped}, ошибок: ${res.data.errors}` })
      await loadPeriods()
    } catch (err: any) {
      setTaskResult({ ok: false, text: err.response?.data?.detail || 'Ошибка создания задач' })
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const res = await api.delete(`/periods/${deleteConfirm.id}`)
      setDeleteConfirm(null)
      setPeriods(prev => prev.filter(p => p.id !== deleteConfirm.id))
      setTaskResult({ ok: true, text: `Период «${deleteConfirm.name}» удалён. Черновиков удалено: ${res.data.deleted_submissions}` })
    } catch (err: any) {
      setTaskResult({ ok: false, text: err.response?.data?.detail || 'Ошибка удаления' })
      setDeleteConfirm(null)
    } finally { setDeleting(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="orb1" /><div className="orb2" />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div className="loader-ring" style={{ margin: '0 auto' }} />
        <p className="loader-text" style={{ marginTop: 20 }}>ЗАГРУЗКА...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div className="orb1" /><div className="orb2" />

      {/* Шапка */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(6,6,15,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="/admin" style={{ textDecoration: 'none', fontSize: 11, color: 'rgba(232,234,246,0.4)' }}>← Админ-панель</a>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 700, letterSpacing: 2, color: 'var(--text)', textTransform: 'uppercase' }}>
              Управление периодами
            </div>
          </div>
          <button
            className="cyber-btn cyber-btn-primary"
            style={{ fontSize: 12, padding: '8px 16px' }}
            onClick={() => setShowForm(v => !v)}
          >
            {showForm ? '✕ Отмена' : '+ Новый период'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>

        {/* Алерт */}
        {taskResult && (
          <div className={`alert-banner ${taskResult.ok ? 'alert-success' : 'alert-warn'}`} style={{ marginBottom: 24 }}>
            <span>{taskResult.ok ? '✅' : '⚠️'}</span>
            <span style={{ flex: 1 }}>{taskResult.text}</span>
            <button onClick={() => setTaskResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 }}>✕</button>
          </div>
        )}

        {/* Форма создания */}
        {showForm && (
          <div className="cyber-card fade-up" style={{ marginBottom: 28 }}>
            <div className="section-title-main" style={{ marginBottom: 20 }}>Создать период</div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={LABEL}>Тип периода</label>
                  <select style={INPUT} value={form.period_type}
                    onChange={e => setForm({ ...form, period_type: e.target.value })}>
                    <option value="monthly">Месячный</option>
                    <option value="quarterly">Квартальный</option>
                    <option value="yearly">Годовой</option>
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Год</label>
                  <input type="number" style={INPUT} value={form.year}
                    onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} />
                </div>
                {form.period_type === 'monthly' && (
                  <div>
                    <label style={LABEL}>Месяц (1–12)</label>
                    <input type="number" min={1} max={12} style={INPUT} value={form.month}
                      onChange={e => setForm({ ...form, month: parseInt(e.target.value) })} />
                  </div>
                )}
                {form.period_type === 'quarterly' && (
                  <div>
                    <label style={LABEL}>Квартал (1–4)</label>
                    <input type="number" min={1} max={4} style={INPUT} value={form.quarter}
                      onChange={e => setForm({ ...form, quarter: parseInt(e.target.value) })} />
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Название периода</label>
                  <input type="text" style={INPUT} value={form.name} placeholder="Например: Апрель 2026"
                    onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label style={LABEL}>Начало периода</label>
                  <input type="date" style={INPUT} value={form.date_start}
                    onChange={e => setForm({ ...form, date_start: e.target.value })} required />
                </div>
                <div>
                  <label style={LABEL}>Конец периода</label>
                  <input type="date" style={INPUT} value={form.date_end}
                    onChange={e => setForm({ ...form, date_end: e.target.value })} required />
                </div>
                <div>
                  <label style={LABEL}>Дедлайн сдачи (сотрудник)</label>
                  <input type="date" style={INPUT} value={form.submit_deadline}
                    onChange={e => setForm({ ...form, submit_deadline: e.target.value })} required />
                </div>
                <div>
                  <label style={LABEL}>Дедлайн проверки (руководитель)</label>
                  <input type="date" style={INPUT} value={form.review_deadline}
                    onChange={e => setForm({ ...form, review_deadline: e.target.value })} required />
                </div>
              </div>
              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                <button type="submit" className="cyber-btn cyber-btn-primary" disabled={creating}>
                  {creating ? '⏳ Создание...' : '✓ Создать'}
                </button>
                <button type="button" className="action-btn btn-view" onClick={() => setShowForm(false)}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Список периодов */}
        {periods.length === 0 ? (
          <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 64 }}>
            Периодов пока нет. Создайте первый период.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {periods.map((p, i) => {
              const isTest = p.date_start === p.date_end
              const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '—'
              return (
                <div
                  key={p.id}
                  className="cyber-card fade-up"
                  style={{ '--accent-color': STATUS_ACCENT[p.status] || 'var(--accent)', animationDelay: `${i * 0.05}s` } as any}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    {/* Левая часть */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</span>
                        <span className={STATUS_BADGE[p.status] || 'badge badge-dim'}>
                          {STATUS_LABEL[p.status] || p.status}
                        </span>
                        {isTest && (
                          <span className="badge badge-warn">⚠️ Тестовый</span>
                        )}
                        {p.redmine_tasks_created && (
                          <span className="badge badge-success">✅ Задачи созданы</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
                        <span>📅 {p.date_start} — {p.date_end}</span>
                        <span>📤 Сдача: {p.submit_deadline}</span>
                        <span>🔍 Проверка: {p.review_deadline}</span>
                        <span>👤 {p.created_by}</span>
                        <span>🕐 Создан: {createdDate}</span>
                      </div>

                      {p.redmine_tasks_created && (
                        <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>
                          Задачи в Redmine: {p.redmine_tasks_count} шт.
                        </div>
                      )}
                    </div>

                    {/* Кнопки */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start' }}>
                      {!p.redmine_tasks_created && (
                        <>
                          <button
                            className="action-btn btn-view"
                            style={{ fontSize: 11, padding: '6px 12px' }}
                            onClick={() => handleDryRun(p.id)}
                          >
                            Dry-run
                          </button>
                          <button
                            className="action-btn btn-fill"
                            style={{ fontSize: 11, padding: '6px 12px' }}
                            onClick={() => handleCreateTasks(p.id)}
                          >
                            Создать задачи
                          </button>
                        </>
                      )}
                      {p.status === 'draft' && (
                        <button
                          className="action-btn"
                          style={{
                            fontSize: 11, padding: '6px 12px',
                            background: 'rgba(255,59,92,0.08)',
                            border: '1px solid rgba(255,59,92,0.3)',
                            color: 'var(--danger)',
                          }}
                          onClick={() => setDeleteConfirm(p)}
                        >
                          🗑 Удалить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Модальное окно удаления */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(6,6,15,0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div className="cyber-card fade-up" style={{
            maxWidth: 440, width: '100%',
            '--accent-color': 'var(--danger)',
          } as any}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, letterSpacing: 2, color: 'var(--danger)', marginBottom: 16, textTransform: 'uppercase' }}>
              Подтверждение удаления
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
              Удалить период «{deleteConfirm.name}»?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.6 }}>
              Это действие также удалит все черновики отчётов за этот период. Отмена невозможна.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="action-btn btn-view"
                style={{ fontSize: 12 }}
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                className="action-btn"
                style={{
                  fontSize: 12,
                  background: 'rgba(255,59,92,0.12)',
                  border: '1px solid rgba(255,59,92,0.4)',
                  color: 'var(--danger)',
                }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '⏳ Удаление...' : '🗑 Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
