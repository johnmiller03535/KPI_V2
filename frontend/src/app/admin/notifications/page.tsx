'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type NotifLog = {
  id: string
  recipient_login: string
  notification_type: string
  period_name: string | null
  status: string
  error_message: string | null
  sent_at: string | null
  created_at: string
}

type Stats = Record<string, number>

const STATUS_COLORS: Record<string, string> = {
  sent:    '#22c55e',
  failed:  '#ef4444',
  skipped: '#f59e0b',
  pending: '#94a3b8',
}

const TYPE_LABELS: Record<string, string> = {
  employee_reminder_3d: 'Сотруднику (3 дня)',
  employee_reminder_1d: 'Сотруднику (1 день)',
  manager_reminder_3d:  'Руководителю (3 дня)',
  manager_reminder_1d:  'Руководителю (1 день)',
  admin_no_telegram:    'Админу (нет TG)',
}

export default function NotificationsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<NotifLog[]>([])
  const [stats, setStats] = useState<Stats>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (!user) { router.push('/login'); return }
    const u = JSON.parse(user)
    if (u.role !== 'admin') { router.push('/dashboard'); return }
    loadData()
  }, [filterStatus])

  async function loadData() {
    setLoading(true)
    try {
      const [logsRes, statsRes] = await Promise.all([
        api.get(`/notifications/logs?limit=50${filterStatus ? `&status=${filterStatus}` : ''}`),
        api.get('/notifications/stats'),
      ])
      setLogs(logsRes.data)
      setStats(statsRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleRunReminders() {
    if (!confirm('Запустить рассылку напоминаний вручную?')) return
    setRunning(true)
    setRunResult(null)
    try {
      const res = await api.post('/notifications/run-reminders')
      setRunResult(res.data)
      await loadData()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка запуска')
    } finally {
      setRunning(false)
    }
  }

  const s: Record<string, any> = {
    page:      { padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' },
    card:      { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' },
    btn:       { padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    filterBtn: (active: boolean) => ({
      padding: '0.35rem 0.75rem',
      background: active ? '#2563eb' : '#f1f5f9',
      color: active ? 'white' : '#334155',
      border: '1px solid ' + (active ? '#2563eb' : '#e2e8f0'),
      borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem',
    }),
    badge: (status: string) => ({
      display: 'inline-block', padding: '0.15rem 0.5rem',
      background: (STATUS_COLORS[status] || '#94a3b8') + '20',
      color: STATUS_COLORS[status] || '#94a3b8',
      borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
    }),
    statCard: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', textAlign: 'center' as const },
  }

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Дашборд</a>
          <h1 style={{ margin: '0.5rem 0 0' }}>Уведомления</h1>
        </div>
        <button style={s.btn} onClick={handleRunReminders} disabled={running}>
          {running ? '⏳ Запуск...' : '▶ Запустить напоминания'}
        </button>
      </div>

      {runResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <strong>Результат рассылки:</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            <div>📤 Сотрудникам: <strong>{runResult.employee_reminders}</strong></div>
            <div>👔 Руководителям: <strong>{runResult.manager_reminders}</strong></div>
            <div>⚠️ Без TG: <strong>{runResult.skipped_no_telegram}</strong></div>
            <div>❌ Ошибок: <strong>{runResult.errors}</strong></div>
          </div>
        </div>
      )}

      {/* Статистика */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {Object.entries(stats).map(([status, count]) => (
          <div key={status} style={s.statCard}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: STATUS_COLORS[status] || '#1e293b' }}>
              {count}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', textTransform: 'capitalize' }}>
              {status}
            </div>
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['', 'sent', 'failed', 'skipped', 'pending'].map(f => (
          <button key={f} style={s.filterBtn(filterStatus === f)} onClick={() => setFilterStatus(f)}>
            {f === '' ? 'Все' : f}
          </button>
        ))}
      </div>

      {/* Логи */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Загрузка...</p>
      ) : logs.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', color: '#64748b', padding: '3rem' }}>
          Уведомлений не найдено
        </div>
      ) : (
        logs.map(log => (
          <div key={log.id} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{log.recipient_login}</strong>
                  <span style={s.badge(log.status)}>{log.status}</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {TYPE_LABELS[log.notification_type] || log.notification_type}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {log.period_name && `Период: ${log.period_name} • `}
                  {new Date(log.created_at).toLocaleString('ru-RU')}
                  {log.error_message && (
                    <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>
                      ⚠ {log.error_message}
                    </span>
                  )}
                </div>
              </div>
              {log.sent_at && (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {new Date(log.sent_at).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
