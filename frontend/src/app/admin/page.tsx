'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type Overview = {
  total_employees: number
  active_employees: number
  dismissed_employees: number
  employees_without_telegram: number
  employees_without_position: number
}

type Period = {
  id: string
  name: string
  period_type: string
  status: string
  submit_deadline: string
  review_deadline: string
  redmine_tasks_created: boolean
}

type PeriodStats = {
  total_employees: number
  draft_count: number
  submitted_count: number
  approved_count: number
  rejected_count: number
  no_submission_count: number
  completion_pct: number
}

type DeptStats = {
  department_code: string
  department_name: string
  total: number
  submitted: number
  approved: number
  pending: number
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  active: '#22c55e',
  review: '#f59e0b',
  closed: '#6366f1',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активен',
  review: 'На проверке',
  closed: 'Закрыт',
}

export default function AdminPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null)
  const [deptStats, setDeptStats] = useState<DeptStats[]>([])
  const [noTgEmployees, setNoTgEmployees] = useState<any[]>([])
  const [syncLogs, setSyncLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'periods' | 'employees' | 'audit' | 'subordination'>('overview')

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (!user) { router.push('/login'); return }
    const u = JSON.parse(user)
    if (u.role !== 'admin') { router.push('/dashboard'); return }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [ovRes, perRes, noTgRes, syncRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/periods'),
        api.get('/admin/employees/no-telegram'),
        api.get('/admin/sync-logs'),
      ])
      setOverview(ovRes.data)
      setPeriods(perRes.data)
      setNoTgEmployees(noTgRes.data)
      setSyncLogs(syncRes.data)

      const active = perRes.data.find((p: Period) => p.status === 'active')
      if (active) {
        setSelectedPeriod(active.id)
        await loadPeriodStats(active.id)
      } else if (perRes.data.length > 0) {
        setSelectedPeriod(perRes.data[0].id)
        await loadPeriodStats(perRes.data[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function loadPeriodStats(periodId: string) {
    try {
      const [statsRes, deptRes] = await Promise.all([
        api.get(`/admin/periods/${periodId}/stats`),
        api.get(`/admin/periods/${periodId}/dept-stats`),
      ])
      setPeriodStats(statsRes.data)
      setDeptStats(deptRes.data)
    } catch (e) {
      console.error(e)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setActionResult(null)
    try {
      const res = await api.post('/sync/run')
      setActionResult(
        `Синхронизация завершена: создано ${res.data.created_count}, ` +
        `обновлено ${res.data.updated_count}, уволено ${res.data.dismissed_count}`
      )
      await loadData()
    } catch (e: any) {
      setActionResult('Ошибка синхронизации: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSyncing(false)
    }
  }

  async function handleReminders() {
    setReminding(true)
    setActionResult(null)
    try {
      const res = await api.post('/notifications/run-reminders')
      setActionResult(
        `Напоминания отправлены: сотрудникам ${res.data.employee_reminders}, ` +
        `руководителям ${res.data.manager_reminders}, ` +
        `без TG ${res.data.skipped_no_telegram}`
      )
    } catch (e: any) {
      setActionResult('Ошибка: ' + (e.response?.data?.detail || e.message))
    } finally {
      setReminding(false)
    }
  }

  const s: Record<string, any> = {
    page: { padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' },
    card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' },
    statCard: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', textAlign: 'center' as const },
    btn: { padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    btnGray: { padding: '0.5rem 1rem', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    btnOrange: { padding: '0.5rem 1rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
    tab: (active: boolean) => ({
      padding: '0.5rem 1.25rem',
      background: 'transparent',
      color: active ? '#2563eb' : '#64748b',
      border: 'none',
      borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: active ? 600 : 400,
    }),
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' },
    grid5: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' },
  }

  if (loading) return <div style={s.page}><p>Загрузка...</p></div>

  return (
    <div style={s.page}>
      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Дашборд</a>
          <h1 style={{ margin: '0.5rem 0 0' }}>Панель администратора</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={s.btnGray} onClick={handleSync} disabled={syncing}>
            {syncing ? '⏳ Синхронизация...' : '🔄 Синхронизировать Redmine'}
          </button>
          <button style={s.btnOrange} onClick={handleReminders} disabled={reminding}>
            {reminding ? '⏳ Рассылка...' : '🔔 Запустить напоминания'}
          </button>
        </div>
      </div>

      {actionResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#166534' }}>
          ✅ {actionResult}
          <button onClick={() => setActionResult(null)} style={{ marginLeft: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>✕</button>
        </div>
      )}

      {/* Табы */}
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: 0, flexWrap: 'wrap' }}>
        {(['overview', 'periods', 'employees', 'subordination', 'audit'] as const).map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'overview' ? '📊 Обзор' :
             tab === 'periods' ? '📅 Периоды' :
             tab === 'employees' ? '👥 Сотрудники' :
             tab === 'subordination' ? '🔗 Подчинённость' : '📋 Аудит'}
          </button>
        ))}
      </div>

      {/* Обзор */}
      {activeTab === 'overview' && overview && (
        <>
          <div style={s.grid5}>
            {[
              { label: 'Всего сотрудников', value: overview.total_employees, color: '#1e293b' },
              { label: 'Активных', value: overview.active_employees, color: '#22c55e' },
              { label: 'Уволенных', value: overview.dismissed_employees, color: '#ef4444' },
              { label: 'Без Telegram', value: overview.employees_without_telegram, color: '#f59e0b' },
              { label: 'Без должности', value: overview.employees_without_position, color: '#f59e0b' },
            ].map(stat => (
              <div key={stat.label} style={s.statCard}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Последние синхронизации */}
          {syncLogs.length > 0 && (
            <div style={s.card}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Последние синхронизации</h2>
              {syncLogs.slice(0, 3).map((log: any) => (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <span style={{ color: log.status === 'success' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {log.status}
                  </span>
                  <span>+{log.created_count} / ~{log.updated_count} / -{log.dismissed_count}</span>
                  <span style={{ color: '#64748b' }}>
                    {log.started_at ? new Date(log.started_at).toLocaleString('ru-RU') : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Статус по периоду */}
          {periodStats && selectedPeriod && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1rem' }}>
                  Статус отчётов: {periods.find(p => p.id === selectedPeriod)?.name}
                </h2>
                <select
                  style={{ padding: '0.375rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.875rem' }}
                  value={selectedPeriod}
                  onChange={e => {
                    setSelectedPeriod(e.target.value)
                    loadPeriodStats(e.target.value)
                  }}
                >
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={s.grid4}>
                {[
                  { label: 'Не сдали', value: periodStats.no_submission_count, color: '#94a3b8' },
                  { label: 'Черновик', value: periodStats.draft_count, color: '#64748b' },
                  { label: 'На проверке', value: periodStats.submitted_count, color: '#f59e0b' },
                  { label: 'Утверждено', value: periodStats.approved_count, color: '#22c55e' },
                ].map(stat => (
                  <div key={stat.label} style={s.statCard}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Прогресс-бар */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  <span>Выполнение: {periodStats.completion_pct}%</span>
                  <span>{periodStats.approved_count} из {periodStats.total_employees}</span>
                </div>
                <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${periodStats.completion_pct}%`,
                    background: periodStats.completion_pct >= 80 ? '#22c55e' : periodStats.completion_pct >= 50 ? '#f59e0b' : '#ef4444',
                    borderRadius: '6px',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              {/* По подразделениям */}
              {deptStats.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.75rem' }}>По подразделениям</h3>
                  {deptStats.map(dept => (
                    <div key={dept.department_code} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.4rem 0', borderBottom: '1px solid #f8fafc', fontSize: '0.875rem' }}>
                      <div style={{ flex: 2, fontWeight: 500 }}>{dept.department_name}</div>
                      <div style={{ flex: 1, color: '#22c55e', textAlign: 'center' as const }}>✅ {dept.approved}</div>
                      <div style={{ flex: 1, color: '#f59e0b', textAlign: 'center' as const }}>⏳ {dept.submitted}</div>
                      <div style={{ flex: 1, color: '#94a3b8', textAlign: 'center' as const }}>📝 {dept.pending}</div>
                      <div style={{ flex: 1, color: '#64748b', textAlign: 'center' as const }}>/{dept.total}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Периоды */}
      {activeTab === 'periods' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <a href="/admin/periods" style={{ ...s.btn, textDecoration: 'none', display: 'inline-block' }}>
              + Управление периодами
            </a>
          </div>
          {periods.length === 0 && (
            <div style={{ ...s.card, color: '#94a3b8', textAlign: 'center' }}>Периоды не найдены</div>
          )}
          {periods.map(p => (
            <div key={p.id} style={{ ...s.card, cursor: 'pointer' }}
              onClick={() => { setSelectedPeriod(p.id); loadPeriodStats(p.id); setActiveTab('overview') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <strong>{p.name}</strong>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      background: (STATUS_COLORS[p.status] || '#94a3b8') + '20',
                      color: STATUS_COLORS[p.status] || '#94a3b8',
                      borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                    }}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                    {p.redmine_tasks_created && (
                      <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>✅ Задачи созданы</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Сдача: {p.submit_deadline} • Проверка: {p.review_deadline}
                  </div>
                </div>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Подробнее →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Сотрудники без TG */}
      {activeTab === 'employees' && (
        <div>
          <div style={{ ...s.card, marginBottom: '1.5rem' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
              ⚠️ Сотрудники без Telegram ID ({noTgEmployees.length})
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1rem' }}>
              Эти сотрудники не получат уведомления. Добавьте им Telegram ID через кастомное поле CF3 в Redmine.
            </p>
            {noTgEmployees.length === 0 ? (
              <p style={{ color: '#22c55e', margin: 0 }}>✅ У всех сотрудников указан Telegram ID</p>
            ) : (
              noTgEmployees.map((emp: any) => (
                <div key={emp.redmine_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <strong>{emp.full_name}</strong>
                  <span style={{ color: '#64748b' }}>{emp.department_name}</span>
                  <span style={{ color: '#94a3b8' }}>{emp.login}</span>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <a href="/admin/periods" style={{ ...s.btn, textDecoration: 'none', display: 'inline-block' }}>
              📅 Управление периодами
            </a>
            <a href="/admin/notifications" style={{ ...s.btnGray, textDecoration: 'none', display: 'inline-block', padding: '0.5rem 1rem' }}>
              🔔 История уведомлений
            </a>
          </div>
        </div>
      )}

      {/* Подчинённость */}
      {activeTab === 'subordination' && (
        <SubordinationTab />
      )}

      {/* Аудит */}
      {activeTab === 'audit' && (
        <AuditTab />
      )}
    </div>
  )
}

type SubordinationEntry = {
  pos_id: number
  role_id: string
  role: string
  unit: string
  management: string
  in_matrix: boolean
  evaluator_role_id: string | null
  evaluator_name: string | null
}

function SubordinationTab() {
  const [entries, setEntries] = useState<SubordinationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saveResult, setSaveResult] = useState<{ role_id: string; ok: boolean } | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await api.get('/admin/subordination')
      setEntries(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Уникальные менеджеры для dropdown (те, у кого есть подчинённые)
  const managerOptions = Array.from(
    new Set(entries.filter(e => e.evaluator_role_id).map(e => e.evaluator_role_id!))
  ).sort()

  async function handleSave(roleId: string) {
    setSaving(roleId)
    setSaveResult(null)
    try {
      await api.patch(`/admin/subordination/${encodeURIComponent(roleId)}`, {
        evaluator_role_id: editValue || null,
      })
      setSaveResult({ role_id: roleId, ok: true })
      setEditingId(null)
      // Обновить локальный state без перезагрузки
      setEntries(prev => prev.map(e =>
        e.role_id === roleId
          ? {
              ...e,
              evaluator_role_id: editValue || null,
              evaluator_name: entries.find(x => x.role_id === editValue)?.role || editValue || null,
            }
          : e
      ))
    } catch (err: any) {
      setSaveResult({ role_id: roleId, ok: false })
      alert(err.response?.data?.detail || 'Ошибка сохранения')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <div className="loader-ring" style={{ margin: '0 auto' }} />
      <p className="loader-text" style={{ marginTop: 16 }}>ЗАГРУЗКА...</p>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, letterSpacing: 2, color: 'var(--accent)', marginBottom: 4 }}>
            МАТРИЦА ПОДЧИНЕНИЯ
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {entries.filter(e => e.in_matrix).length} должностей в матрице · {entries.length} всего в KPI_Mapping
          </div>
        </div>
        <button className="cyber-btn" style={{ fontSize: 12 }} onClick={loadData}>
          🔄 Обновить
        </button>
      </div>

      {saveResult?.ok && (
        <div className="alert-banner alert-success" style={{ marginBottom: 16 }}>
          <span>✅</span>
          <span>Сохранено успешно</span>
        </div>
      )}

      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        <table className="review-table">
          <thead>
            <tr>
              <th>Должность</th>
              <th>Подразделение</th>
              <th>Управление</th>
              <th>Руководитель</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.filter(e => e.in_matrix).map((entry, i) => (
              <tr key={entry.role_id} className="fade-up" style={{ animationDelay: `${i * 0.02}s` }}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.role}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{entry.role_id}</div>
                </td>
                <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{entry.unit}</td>
                <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{entry.management}</td>
                <td>
                  {editingId === entry.role_id ? (
                    <select
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(0,229,255,0.4)',
                        borderRadius: 6,
                        color: 'var(--text)',
                        fontSize: 12,
                        padding: '4px 8px',
                        width: '100%',
                        maxWidth: 260,
                      }}
                    >
                      <option value="">— Директорский уровень (null) —</option>
                      {entries
                        .filter(e => e.role_id !== entry.role_id)
                        .map(e => (
                          <option key={e.role_id} value={e.role_id}>
                            {e.role} ({e.role_id})
                          </option>
                        ))
                      }
                    </select>
                  ) : entry.evaluator_role_id ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.evaluator_name || entry.evaluator_role_id}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{entry.evaluator_role_id}</div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>— директор —</span>
                  )}
                </td>
                <td>
                  {editingId === entry.role_id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="action-btn btn-fill"
                        style={{ fontSize: 11, padding: '5px 12px' }}
                        onClick={() => handleSave(entry.role_id)}
                        disabled={saving === entry.role_id}
                      >
                        {saving === entry.role_id ? '...' : '💾 Сохранить'}
                      </button>
                      <button
                        className="action-btn"
                        style={{ fontSize: 11, padding: '5px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={() => setEditingId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="action-btn btn-view"
                      style={{ fontSize: 11, padding: '5px 12px' }}
                      onClick={() => {
                        setEditingId(entry.role_id)
                        setEditValue(entry.evaluator_role_id || '')
                        setSaveResult(null)
                      }}
                    >
                      ✏️ Изменить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {entries.filter(e => !e.in_matrix).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            Должности из KPI_Mapping, не включённые в матрицу подчинения ({entries.filter(e => !e.in_matrix).length}):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {entries.filter(e => !e.in_matrix).map(e => (
              <span key={e.role_id} style={{
                fontSize: 11, color: 'var(--text-dim)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '2px 8px',
              }}>
                {e.role_id}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/audit-log?limit=50')
      .then(res => setLogs(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: '#64748b' }}>Загрузка...</p>

  if (logs.length === 0) return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
      Журнал аудита пуст
    </div>
  )

  return (
    <div>
      <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Журнал аудита (последние 50)</h2>
      {logs.map((log: any) => (
        <div key={log.id} style={{
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px',
          padding: '0.75rem 1rem', marginBottom: '0.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '0.875rem',
        }}>
          <div>
            <strong>{log.user_login || '—'}</strong>
            <span style={{ marginLeft: '0.75rem', color: '#64748b' }}>{log.action}</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            {log.ip_address && <span style={{ marginRight: '0.75rem' }}>{log.ip_address}</span>}
            {log.created_at ? new Date(log.created_at).toLocaleString('ru-RU') : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}
