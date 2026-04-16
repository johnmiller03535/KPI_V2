'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активен',
  review: 'На проверке',
  closed: 'Закрыт',
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  active: '#22c55e',
  review: '#f59e0b',
  closed: '#6366f1',
}

export default function PeriodsPage() {
  const router = useRouter()
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [taskResult, setTaskResult] = useState<string | null>(null)

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
    try {
      const res = await api.get('/periods')
      setPeriods(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
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
    } finally {
      setCreating(false)
    }
  }

  async function handleDryRun(periodId: string) {
    try {
      const res = await api.post(`/periods/${periodId}/create-tasks?dry_run=true`)
      setTaskResult(`Dry-run: будет создано ${res.data.created} задач, пропущено ${res.data.skipped}`)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка')
    }
  }

  async function handleCreateTasks(periodId: string) {
    if (!confirm('Создать задачи в Redmine для всех сотрудников? Это действие нельзя отменить.')) return
    try {
      const res = await api.post(`/periods/${periodId}/create-tasks`)
      setTaskResult(`Создано: ${res.data.created}, пропущено: ${res.data.skipped}, ошибок: ${res.data.errors}`)
      await loadPeriods()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка создания задач')
    }
  }

  const s: Record<string, any> = {
    page: { padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
    btn: { padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    btnGray: { padding: '0.5rem 1rem', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    btnGreen: { padding: '0.4rem 0.75rem', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' },
    card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' },
    label: { display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' },
    input: { width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.875rem', boxSizing: 'border-box' as const },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
    badge: (status: string) => ({
      display: 'inline-block', padding: '0.2rem 0.6rem',
      background: STATUS_COLORS[status] + '20',
      color: STATUS_COLORS[status],
      borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
    }),
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={{ margin: 0 }}>Управление периодами</h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
            <a href="/dashboard" style={{ color: '#2563eb' }}>← Дашборд</a>
          </p>
        </div>
        <button style={s.btn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Отмена' : '+ Новый период'}
        </button>
      </div>

      {taskResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#166534' }}>
          {taskResult}
          <button onClick={() => setTaskResult(null)} style={{ marginLeft: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>✕</button>
        </div>
      )}

      {showForm && (
        <div style={s.card}>
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Создать период</h2>
          <form onSubmit={handleCreate}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Тип периода</label>
                <select style={s.input} value={form.period_type}
                  onChange={e => setForm({ ...form, period_type: e.target.value })}>
                  <option value="monthly">Месячный</option>
                  <option value="quarterly">Квартальный</option>
                  <option value="yearly">Годовой</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Год</label>
                <input type="number" style={s.input} value={form.year}
                  onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} />
              </div>
              {form.period_type === 'monthly' && (
                <div>
                  <label style={s.label}>Месяц (1-12)</label>
                  <input type="number" min={1} max={12} style={s.input} value={form.month}
                    onChange={e => setForm({ ...form, month: parseInt(e.target.value) })} />
                </div>
              )}
              {form.period_type === 'quarterly' && (
                <div>
                  <label style={s.label}>Квартал (1-4)</label>
                  <input type="number" min={1} max={4} style={s.input} value={form.quarter}
                    onChange={e => setForm({ ...form, quarter: parseInt(e.target.value) })} />
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Название периода</label>
                <input type="text" style={s.input} value={form.name} placeholder="Например: Март 2026"
                  onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label style={s.label}>Начало периода</label>
                <input type="date" style={s.input} value={form.date_start}
                  onChange={e => setForm({ ...form, date_start: e.target.value })} required />
              </div>
              <div>
                <label style={s.label}>Конец периода</label>
                <input type="date" style={s.input} value={form.date_end}
                  onChange={e => setForm({ ...form, date_end: e.target.value })} required />
              </div>
              <div>
                <label style={s.label}>Дедлайн сдачи (сотрудник)</label>
                <input type="date" style={s.input} value={form.submit_deadline}
                  onChange={e => setForm({ ...form, submit_deadline: e.target.value })} required />
              </div>
              <div>
                <label style={s.label}>Дедлайн проверки (руководитель)</label>
                <input type="date" style={s.input} value={form.review_deadline}
                  onChange={e => setForm({ ...form, review_deadline: e.target.value })} required />
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <button type="submit" style={s.btn} disabled={creating}>
                {creating ? 'Создание...' : 'Создать'}
              </button>
              <button type="button" style={s.btnGray} onClick={() => setShowForm(false)}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#64748b' }}>Загрузка...</p>
      ) : periods.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', color: '#64748b', padding: '3rem' }}>
          Периодов пока нет. Создайте первый период.
        </div>
      ) : (
        periods.map(p => (
          <div key={p.id} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{p.name}</h3>
                  <span style={s.badge(p.status)}>{STATUS_LABELS[p.status] || p.status}</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', display: 'grid', gridTemplateColumns: 'auto auto auto auto', gap: '0 1.5rem' }}>
                  <span>Период: {p.date_start} — {p.date_end}</span>
                  <span>Сдача: {p.submit_deadline}</span>
                  <span>Проверка: {p.review_deadline}</span>
                  <span>Создал: {p.created_by}</span>
                </div>
                {p.redmine_tasks_created && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#22c55e' }}>
                    Задачи в Redmine созданы: {p.redmine_tasks_count} шт.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: '1rem' }}>
                {!p.redmine_tasks_created && (
                  <>
                    <button style={s.btnGray} onClick={() => handleDryRun(p.id)}>
                      Dry-run
                    </button>
                    <button style={s.btnGreen} onClick={() => handleCreateTasks(p.id)}>
                      Создать задачи
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
