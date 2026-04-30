'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

// ─── Типы ─────────────────────────────────────────────────────────────────────

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

type DismissedEmployee = {
  redmine_id: string
  name: string
  position_id: string | null
  role_id: string | null
  role_name: string | null
  unit: string | null
  dismissed_at: string | null
}

// ─── Хелперы ──────────────────────────────────────────────────────────────────

const PERIOD_STATUS_BADGE: Record<string, string> = {
  draft:  'badge badge-info',
  active: 'badge badge-success',
  review: 'badge badge-warn',
  closed: 'badge badge-dim',
}
const PERIOD_STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик', active: 'Активен', review: 'На проверке', closed: 'Закрыт',
}

function progressColor(pct: number) {
  if (pct >= 80) return 'var(--accent3)'
  if (pct >= 50) return 'var(--warn)'
  return 'var(--danger)'
}

// ─── Стили таблиц (применяются inline, переопределяют review-table) ──────────

const TH: React.CSSProperties = {
  padding: '10px 16px',
  fontFamily: 'Orbitron, monospace',
  fontSize: 10,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: 'var(--accent)',
  borderBottom: '1px solid rgba(0,229,255,0.2)',
  textAlign: 'left',
  fontWeight: 600,
}
const TD: React.CSSProperties = {
  padding: '12px 16px',
  fontFamily: 'Exo 2, sans-serif',
  fontSize: 13,
  color: 'rgba(255,255,255,0.85)',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'middle',
}

// ─── Компонент: страница ──────────────────────────────────────────────────────

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
  const [actionResult, setActionResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'periods' | 'employees' | 'subordination' | 'audit' | 'kpi'>('overview')
  const [showDismissedModal, setShowDismissedModal] = useState(false)
  const [dismissedEmployees, setDismissedEmployees] = useState<DismissedEmployee[]>([])
  const [loadingDismissed, setLoadingDismissed] = useState(false)
  const [showNoTelegramModal, setShowNoTelegramModal] = useState(false)

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
      const first = active || perRes.data[0]
      if (first) {
        setSelectedPeriod(first.id)
        await loadPeriodStats(first.id)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function loadPeriodStats(periodId: string) {
    try {
      const [statsRes, deptRes] = await Promise.all([
        api.get(`/admin/periods/${periodId}/stats`),
        api.get(`/admin/periods/${periodId}/dept-stats`),
      ])
      setPeriodStats(statsRes.data)
      setDeptStats(deptRes.data)
    } catch (e) { console.error(e) }
  }

  async function handleSync() {
    setSyncing(true); setActionResult(null)
    try {
      const res = await api.post('/sync/run')
      setActionResult({
        ok: true,
        text: `Синхронизация завершена: +${res.data.created_count} / ~${res.data.updated_count} / -${res.data.dismissed_count}`,
      })
      await loadData()
    } catch (e: any) {
      setActionResult({ ok: false, text: 'Ошибка: ' + (e.response?.data?.detail || e.message) })
    } finally { setSyncing(false) }
  }

  async function handleReminders() {
    setReminding(true); setActionResult(null)
    try {
      const res = await api.post('/notifications/run-reminders')
      setActionResult({
        ok: true,
        text: `Напоминания: сотрудникам ${res.data.employee_reminders}, руководителям ${res.data.manager_reminders}, без TG ${res.data.skipped_no_telegram}`,
      })
    } catch (e: any) {
      setActionResult({ ok: false, text: 'Ошибка: ' + (e.response?.data?.detail || e.message) })
    } finally { setReminding(false) }
  }

  async function handleShowDismissed() {
    setShowDismissedModal(true)
    if (dismissedEmployees.length > 0) return
    setLoadingDismissed(true)
    try {
      const res = await api.get('/admin/employees/dismissed')
      setDismissedEmployees(res.data)
    } catch (e) { console.error(e) }
    finally { setLoadingDismissed(false) }
  }

  const TABS = [
    { id: 'overview',       label: 'Обзор' },
    { id: 'periods',        label: 'Периоды' },
    { id: 'employees',      label: 'Сотрудники' },
    { id: 'subordination',  label: 'Подчинённость' },
    { id: 'audit',          label: 'Аудит' },
    { id: 'kpi',            label: 'KPI-карточки' },
  ] as const

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

      {/* ── Шапка ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(6,6,15,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(232,234,246,0.4)', fontSize: 11 }}>
              ← Дашборд
            </a>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 700, letterSpacing: 2, color: 'var(--text)', textTransform: 'uppercase' }}>
              Панель администратора
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="cyber-btn cyber-btn-primary"
              style={{ fontSize: 12, padding: '8px 16px' }}
              onClick={handleSync} disabled={syncing}
            >
              {syncing ? '⏳ Синх...' : '🔄 Синхронизировать Redmine'}
            </button>
            <button
              className="cyber-btn"
              style={{ fontSize: 12, padding: '8px 16px', background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.35)', color: 'var(--warn)' }}
              onClick={handleReminders} disabled={reminding}
            >
              {reminding ? '⏳ Рассылка...' : '🔔 Напоминания'}
            </button>
          </div>
        </div>

        {/* Табы */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0 20px', height: 40,
                fontFamily: 'Exo 2, sans-serif', fontSize: 11, fontWeight: 600,
                letterSpacing: '1px', textTransform: 'uppercase',
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: activeTab === tab.id ? 'var(--accent)' : 'rgba(232,234,246,0.45)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Контент ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>

        {/* Алерт */}
        {actionResult && (
          <div className={`alert-banner ${actionResult.ok ? 'alert-success' : 'alert-warn'}`} style={{ marginBottom: 24 }}>
            <span>{actionResult.ok ? '✅' : '⚠️'}</span>
            <span style={{ flex: 1 }}>{actionResult.text}</span>
            <button onClick={() => setActionResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 }}>✕</button>
          </div>
        )}

        {/* ══ ТАБ: ОБЗОР ══ */}
        {activeTab === 'overview' && overview && (
          <div className="fade-up">
            {/* Stat-карточки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Всего',         value: overview.total_employees,               accent: '#00e5ff',  onClick: undefined },
                { label: 'Активных',      value: overview.active_employees,              accent: '#00ff9d',  onClick: undefined },
                { label: 'Уволенных',     value: overview.dismissed_employees,           accent: '#ff3b5c',  onClick: handleShowDismissed },
                { label: 'Без Telegram',  value: overview.employees_without_telegram,    accent: '#ffb800',  onClick: () => setShowNoTelegramModal(true) },
                { label: 'Без должности', value: overview.employees_without_position,    accent: '#ffb800',  onClick: undefined },
              ].map(s => (
                <div
                  key={s.label}
                  className="stat-card"
                  style={{ '--card-accent': s.accent, cursor: s.onClick ? 'pointer' : 'default' } as any}
                  onClick={s.onClick}
                  title={s.onClick ? 'Нажмите для просмотра' : undefined}
                >
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.accent, textShadow: `0 0 20px ${s.accent}` }}>{s.value}</div>
                  {s.onClick && <div style={{ fontSize: 10, color: s.accent, opacity: 0.7, marginTop: 4, fontFamily: 'Orbitron, monospace', letterSpacing: 1 }}>↗ подробнее</div>}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              {/* Синхронизации */}
              {syncLogs.length > 0 && (
                <div className="cyber-card">
                  <div className="section-title-main" style={{ marginBottom: 16 }}>Последние синхронизации</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH}>Статус</th>
                        <th style={TH}>+Создано / ~Обновлено / -Уволено</th>
                        <th style={TH}>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncLogs.slice(0, 5).map((log: any) => (
                        <tr key={log.id}>
                          <td style={TD}>
                            <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-fail'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td style={{ ...TD, fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-dim)' }}>
                            +{log.created_count} / ~{log.updated_count} / -{log.dismissed_count}
                          </td>
                          <td style={{ ...TD, fontSize: 11, color: 'var(--text-dim)' }}>
                            {log.started_at ? new Date(log.started_at).toLocaleString('ru-RU') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Статус отчётов по периоду */}
              {periodStats && selectedPeriod && (
                <div className="cyber-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div className="section-title-main" style={{ margin: 0 }}>Статус отчётов</div>
                    <select
                      value={selectedPeriod}
                      onChange={e => { setSelectedPeriod(e.target.value); loadPeriodStats(e.target.value) }}
                      style={{
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)',
                        borderRadius: 8, color: 'var(--text)', fontSize: 12,
                        padding: '4px 10px', fontFamily: 'Exo 2, sans-serif',
                      }}
                    >
                      {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Не сдали',    value: periodStats.no_submission_count, color: 'var(--text-dim)' },
                      { label: 'Черновик',    value: periodStats.draft_count,         color: 'var(--accent)' },
                      { label: 'Проверка',    value: periodStats.submitted_count,     color: 'var(--warn)' },
                      { label: 'Утверждено',  value: periodStats.approved_count,      color: 'var(--accent3)' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
                      <span>Выполнение</span>
                      <span style={{ fontFamily: 'Orbitron, monospace', color: progressColor(periodStats.completion_pct) }}>
                        {periodStats.approved_count} / {periodStats.total_employees} · {periodStats.completion_pct}%
                      </span>
                    </div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar-fill" style={{
                        width: `${periodStats.completion_pct}%`,
                        background: progressColor(periodStats.completion_pct),
                        color: progressColor(periodStats.completion_pct),
                      }} />
                    </div>
                  </div>

                  {/* По подразделениям */}
                  {deptStats.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'Orbitron, monospace', letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>По подразделениям</div>
                      {deptStats.map(dept => {
                        const pct = dept.total > 0 ? Math.round(dept.approved / dept.total * 100) : 0
                        return (
                          <div key={dept.department_code} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: 'var(--text)' }}>{dept.department_name}</span>
                              <span style={{ fontSize: 11, fontFamily: 'Orbitron, monospace', color: progressColor(pct) }}>{dept.approved}/{dept.total}</span>
                            </div>
                            <div className="progress-bar-wrap" style={{ height: 4 }}>
                              <div className="progress-bar-fill" style={{ width: `${pct}%`, background: progressColor(pct), color: progressColor(pct) }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ТАБ: ПЕРИОДЫ ══ */}
        {activeTab === 'periods' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="section-title-main" style={{ margin: 0 }}>Периоды оценки</div>
              <a href="/admin/periods" className="action-btn btn-fill" style={{ textDecoration: 'none' }}>
                + Управление периодами
              </a>
            </div>

            {periods.length === 0 ? (
              <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 48 }}>
                Периоды не найдены
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {periods.map(p => (
                  <div
                    key={p.id}
                    className="cyber-card"
                    style={{ cursor: 'pointer', '--accent-color': p.status === 'active' ? 'var(--accent3)' : p.status === 'review' ? 'var(--warn)' : 'var(--accent)' } as any}
                    onClick={() => { setSelectedPeriod(p.id); loadPeriodStats(p.id); setActiveTab('overview') }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                          <span className={PERIOD_STATUS_BADGE[p.status] || 'badge badge-dim'}>
                            {PERIOD_STATUS_LABEL[p.status] || p.status}
                          </span>
                          {p.redmine_tasks_created && (
                            <span className="badge badge-success">✅ Задачи созданы</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          Сдача: {p.submit_deadline} &nbsp;·&nbsp; Проверка: {p.review_deadline}
                        </div>
                      </div>
                      <span style={{ color: 'var(--accent)', fontSize: 18 }}>→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ ТАБ: СОТРУДНИКИ ══ */}
        {activeTab === 'employees' && (
          <div className="fade-up">
            <div className="cyber-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div className="section-title-main" style={{ margin: 0 }}>Без Telegram ID</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                    Эти сотрудники не получат уведомления. Добавьте telegram_id через кастомное поле CF3 в Redmine.
                  </div>
                </div>
                <span className={noTgEmployees.length === 0 ? 'badge badge-success' : 'badge badge-fail'}>
                  {noTgEmployees.length === 0 ? 'Все заполнены' : `${noTgEmployees.length} без TG`}
                </span>
              </div>

              {noTgEmployees.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--accent3)', fontSize: 14 }}>
                  ✅ У всех активных сотрудников указан Telegram ID
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TH}>ФИО</th>
                      <th style={TH}>Подразделение</th>
                      <th style={TH}>Логин</th>
                      <th style={TH}>Должность (pos_id)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noTgEmployees.map((emp: any) => (
                      <tr key={emp.redmine_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={TD}><strong>{emp.full_name}</strong></td>
                        <td style={{ ...TD, color: 'var(--text-dim)', fontSize: 12 }}>{emp.department_name}</td>
                        <td style={{ ...TD, fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-dim)' }}>{emp.login}</td>
                        <td style={{ ...TD, fontSize: 12 }}>
                          {emp.position_id
                            ? <span className="badge badge-info">{emp.position_id}</span>
                            : <span className="badge badge-fail">не задана</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/admin/periods" className="action-btn btn-fill" style={{ textDecoration: 'none' }}>
                📅 Управление периодами
              </a>
              <a href="/admin/notifications" className="action-btn btn-view" style={{ textDecoration: 'none' }}>
                🔔 История уведомлений
              </a>
            </div>
          </div>
        )}

        {/* ══ ТАБ: ПОДЧИНЁННОСТЬ ══ */}
        {activeTab === 'subordination' && <SubordinationTab />}

        {/* ══ ТАБ: АУДИТ ══ */}
        {activeTab === 'audit' && <AuditTab />}

        {/* ══ ТАБ: KPI-КАРТОЧКИ ══ */}
        {activeTab === 'kpi' && <KpiTab />}
      </div>

      {/* ══ МОДАЛЬНОЕ ОКНО: БЕЗ TELEGRAM ══ */}
      {showNoTelegramModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(6,6,15,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNoTelegramModal(false) }}
        >
          <div className="cyber-card" style={{ width: '100%', maxWidth: 760, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div className="cyber-title" style={{ fontSize: 18 }}>
                <span style={{ color: '#ffb800' }}>●</span> Без Telegram ID
              </div>
              <button
                onClick={() => setShowNoTelegramModal(false)}
                style={{ background: 'none', border: '1px solid rgba(255,184,0,0.4)', borderRadius: 6, color: '#ffb800', cursor: 'pointer', padding: '4px 12px', fontFamily: 'Orbitron, monospace', fontSize: 11 }}
              >
                ✕ ЗАКРЫТЬ
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {noTgEmployees.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>
                  Все сотрудники привязаны к Telegram
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TH}>ФИО</th>
                      <th style={TH}>Должность (pos_id)</th>
                      <th style={TH}>Подразделение</th>
                      <th style={TH}>Redmine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noTgEmployees.map((e: any) => (
                      <tr key={e.redmine_id}>
                        <td style={{ ...TD, fontWeight: 600 }}>{e.full_name || e.name || '—'}</td>
                        <td style={{ ...TD, color: 'var(--text-dim)', fontSize: 12, fontFamily: 'Orbitron, monospace' }}>
                          {e.position_id || '—'}
                        </td>
                        <td style={{ ...TD, color: 'var(--text-dim)', fontSize: 12 }}>{e.department_name || '—'}</td>
                        <td style={TD}>
                          <a
                            href={`https://kkp.rm.mosreg.ru/people/${e.redmine_id}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#ffb800', fontSize: 12, textDecoration: 'none', fontFamily: 'Orbitron, monospace' }}
                          >
                            ↗ Открыть
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ МОДАЛЬНОЕ ОКНО: УВОЛЕННЫЕ ══ */}
      {showDismissedModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(6,6,15,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDismissedModal(false) }}
        >
          <div className="cyber-card" style={{ width: '100%', maxWidth: 860, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div className="cyber-title" style={{ fontSize: 18 }}>
                <span style={{ color: 'var(--danger)' }}>●</span> Уволенные сотрудники
              </div>
              <button
                onClick={() => setShowDismissedModal(false)}
                style={{ background: 'none', border: '1px solid rgba(255,59,92,0.4)', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '4px 12px', fontFamily: 'Orbitron, monospace', fontSize: 11 }}
              >
                ✕ ЗАКРЫТЬ
              </button>
            </div>
            {loadingDismissed ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                <div className="loader-ring" style={{ margin: '0 auto 12px' }} />
                Загрузка...
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {dismissedEmployees.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>
                    Уволенных сотрудников нет
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH}>ФИО</th>
                        <th style={TH}>Должность</th>
                        <th style={TH}>Подразделение</th>
                        <th style={TH}>Дата увольнения</th>
                        <th style={TH}>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dismissedEmployees.map((e) => (
                        <tr key={e.redmine_id}>
                          <td style={{ ...TD, fontWeight: 600 }}>{e.name}</td>
                          <td style={{ ...TD, color: 'var(--text-dim)', fontSize: 12 }}>
                            {e.role_name || e.position_id || '—'}
                          </td>
                          <td style={{ ...TD, color: 'var(--text-dim)', fontSize: 12 }}>{e.unit || '—'}</td>
                          <td style={{ ...TD, fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-dim)' }}>
                            {e.dismissed_at || '—'}
                          </td>
                          <td style={TD}>
                            <span className="badge badge-fail">Уволен</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Компонент: Подчинённость ─────────────────────────────────────────────────

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
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<any>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await api.get('/admin/subordination')
      setEntries(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSave(roleId: string) {
    setSaving(roleId); setSaveResult(null)
    try {
      await api.patch(`/admin/subordination/${encodeURIComponent(roleId)}`, {
        evaluator_role_id: editValue || null,
      })
      setSaveResult({ role_id: roleId, ok: true })
      setEditingId(null)
      setEntries(prev => prev.map(e =>
        e.role_id === roleId
          ? { ...e, evaluator_role_id: editValue || null, evaluator_name: entries.find(x => x.role_id === editValue)?.role || editValue || null }
          : e
      ))
    } catch (err: any) {
      setSaveResult({ role_id: roleId, ok: false })
      alert(err.response?.data?.detail || 'Ошибка сохранения')
    } finally { setSaving(null) }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64 }}>
      <div className="loader-ring" style={{ margin: '0 auto' }} />
      <p className="loader-text" style={{ marginTop: 20 }}>ЗАГРУЗКА...</p>
    </div>
  )

  const inMatrix = entries.filter(e => e.in_matrix)
  const notInMatrix = entries.filter(e => !e.in_matrix)

  return (
    <div className="fade-up">
      {/* Заголовок + кнопки */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div className="section-title-main" style={{ margin: 0 }}>Матрица подчинения</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {inMatrix.length} должностей в матрице · {entries.length} всего в KPI_Mapping
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="cyber-btn cyber-btn-primary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={loadData}>
            🔄 Обновить
          </button>
          <button
            className="cyber-btn cyber-btn-success"
            style={{ fontSize: 12, padding: '8px 14px' }}
            onClick={async () => {
              setRebuilding(true); setRebuildResult(null)
              try {
                const res = await api.post('/admin/subordination/rebuild-from-people-export')
                setRebuildResult({ ok: true, ...res.data })
                await loadData()
              } catch (err: any) {
                setRebuildResult({ ok: false, error: err.response?.data?.detail || 'Ошибка' })
              } finally { setRebuilding(false) }
            }}
            disabled={rebuilding}
          >
            {rebuilding ? '⏳ Импорт...' : '📥 Импорт из People'}
          </button>
        </div>
      </div>

      {rebuildResult && (
        <div className={`alert-banner ${rebuildResult.ok ? 'alert-success' : 'alert-warn'}`} style={{ marginBottom: 16 }}>
          {rebuildResult.ok
            ? <span>✅ Импортировано: {rebuildResult.mapped_pairs} пар · файл: {rebuildResult.file?.split('/').pop()}</span>
            : <span>⚠️ {typeof rebuildResult.error === 'object' ? JSON.stringify(rebuildResult.error) : rebuildResult.error}</span>}
        </div>
      )}
      {saveResult?.ok && (
        <div className="alert-banner alert-success" style={{ marginBottom: 16 }}>
          ✅ Сохранено
        </div>
      )}

      {/* Таблица */}
      <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Должность</th>
              <th style={TH}>Подразделение</th>
              <th style={TH}>Управление</th>
              <th style={TH}>Руководитель</th>
              <th style={{ ...TH, width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {inMatrix.map((entry, i) => (
              <tr key={entry.role_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={TD}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.role}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'Orbitron, monospace' }}>{entry.role_id}</div>
                </td>
                <td style={{ ...TD, fontSize: 12, color: 'var(--text-dim)' }}>{entry.unit}</td>
                <td style={{ ...TD, fontSize: 11, color: 'var(--text-dim)' }}>{entry.management}</td>
                <td style={TD}>
                  {editingId === entry.role_id ? (
                    <select
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,229,255,0.35)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '4px 8px', width: '100%', maxWidth: 260 }}
                    >
                      <option value="">— Директорский уровень —</option>
                      {entries.filter(e => e.role_id !== entry.role_id).map(e => (
                        <option key={e.role_id} value={e.role_id}>{e.role} ({e.role_id})</option>
                      ))}
                    </select>
                  ) : entry.evaluator_role_id ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{entry.evaluator_name || entry.evaluator_role_id}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginTop: 2 }}>{entry.evaluator_role_id}</div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: 12, fontStyle: 'italic' }}>— директор —</span>
                  )}
                </td>
                <td style={{ ...TD, textAlign: 'right' }}>
                  {editingId === entry.role_id ? (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="action-btn btn-fill"
                        style={{ fontSize: 11, padding: '4px 12px' }}
                        onClick={() => handleSave(entry.role_id)}
                        disabled={saving === entry.role_id}
                      >
                        {saving === entry.role_id ? '...' : '💾'}
                      </button>
                      <button
                        className="action-btn btn-view"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => setEditingId(null)}
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      className="action-btn btn-view"
                      style={{ fontSize: 11, padding: '4px 12px' }}
                      onClick={() => { setEditingId(entry.role_id); setEditValue(entry.evaluator_role_id || ''); setSaveResult(null) }}
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

      {/* Не в матрице */}
      {notInMatrix.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, fontFamily: 'Orbitron, monospace', letterSpacing: 1 }}>
            НЕ В МАТРИЦЕ ({notInMatrix.length}):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {notInMatrix.map(e => (
              <span key={e.role_id} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 8px' }}>
                {e.role_id}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Компонент: Аудит ─────────────────────────────────────────────────────────

const ACTION_BADGE: Record<string, string> = {
  login: 'badge badge-info',
  logout: 'badge badge-dim',
  submit: 'badge badge-warn',
  approve: 'badge badge-success',
  reject: 'badge badge-fail',
}

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get('/admin/audit-log?limit=50')
      .then(res => setLogs(Array.isArray(res.data) ? res.data : []))
      .catch(e => setError(e?.response?.data?.detail || e?.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64 }}>
      <div className="loader-ring" style={{ margin: '0 auto' }} />
      <p className="loader-text" style={{ marginTop: 20 }}>ЗАГРУЗКА...</p>
    </div>
  )

  if (error) return (
    <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--danger)', padding: 48, fontFamily: 'Exo 2, sans-serif' }}>
      ⚠️ {error}
    </div>
  )

  if (logs.length === 0) return (
    <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 48 }}>
      Журнал аудита пуст
    </div>
  )

  return (
    <div className="fade-up">
      <div className="section-title-main">Журнал аудита (последние 50)</div>
      <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Пользователь</th>
              <th style={TH}>Действие</th>
              <th style={TH}>IP-адрес</th>
              <th style={TH}>Дата и время</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any, idx: number) => (
              <tr key={log?.id ?? idx}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...TD, fontWeight: 600 }}>{log?.user_login || '—'}</td>
                <td style={TD}>
                  <span className={ACTION_BADGE[log?.action] || 'badge badge-dim'}>
                    {log?.action || '—'}
                  </span>
                </td>
                <td style={{ ...TD, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace' }}>
                  {log?.ip_address || '—'}
                </td>
                <td style={{ ...TD, fontSize: 11, fontFamily: 'Orbitron, monospace', color: 'var(--text-dim)' }}>
                  {log?.created_at ? new Date(log.created_at).toLocaleString('ru-RU') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// KPI-КАРТОЧКИ TAB
// ════════════════════════════════════════════════════════════════════

const TYPE_LABELS: Record<string, string> = {
  binary_auto: 'Авто',
  binary_manual: 'Ручной',
  threshold: 'Порог',
  multi_threshold: 'Мульти-порог',
  quarterly_threshold: 'Квартальный',
}

const TYPE_COLORS: Record<string, string> = {
  binary_auto: 'var(--accent)',
  binary_manual: 'var(--warn)',
  threshold: 'var(--accent3)',
  multi_threshold: '#b4a0ff',
  quarterly_threshold: '#ff8c00',
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge badge-warn',
  active: 'badge badge-success',
  archived: 'badge badge-dim',
}

function KpiTab() {
  const [indicators, setIndicators] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIndicator, setSelectedIndicator] = useState<any>(null)
  const [selectedPosId, setSelectedPosId] = useState('')
  const [card, setCard] = useState<any>(null)
  const [cardLoading, setCardLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/kpi/indicators?status=all').then(r => r.data),
      api.get('/kpi/cards?status=active').then(r => r.data),
    ]).then(([inds, cds]) => {
      setIndicators(Array.isArray(inds) ? inds : (inds.items ?? []))
      setCards(Array.isArray(cds) ? cds : (cds.items ?? []))
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedPosId) { setCard(null); return }
    setCardLoading(true)
    api.get(`/kpi/cards/${selectedPosId}/active`)
      .then(r => setCard(r.data))
      .catch(() => setCard(null))
      .finally(() => setCardLoading(false))
  }, [selectedPosId])

  const filtered = indicators.filter(ind => {
    if (filterType && ind.formula_type !== filterType) return false
    if (filterStatus && ind.status !== filterStatus) return false
    if (search && !ind.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalWeight = card?.total_weight ?? card?.indicators?.reduce((s: number, ci: any) => s + (ci.weight || 0), 0) ?? 0

  const SEL = {
    background: 'rgba(0,229,255,0.07)',
    border: '1px solid rgba(0,229,255,0.25)',
    borderRadius: 8,
    color: 'var(--text)',
    padding: '8px 12px',
    fontFamily: 'Exo 2, sans-serif',
    fontSize: 14,
    cursor: 'pointer',
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64 }}>
      <div className="loader-ring" style={{ margin: '0 auto' }} />
      <p className="loader-text" style={{ marginTop: 20 }}>ЗАГРУЗКА...</p>
    </div>
  )

  return (
    <>
    <div className="fade-up">

      {/* ── СЕКЦИЯ 1: БИБЛИОТЕКА ПОКАЗАТЕЛЕЙ ── */}
      <div className="section-title-main" style={{ marginBottom: 16 }}>
        Библиотека показателей
        <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace' }}>
          {filtered.length} / {indicators.length}
        </span>
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <select style={SEL} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Все типы</option>
          <option value="binary_auto">binary_auto</option>
          <option value="binary_manual">binary_manual</option>
          <option value="threshold">threshold</option>
          <option value="multi_threshold">multi_threshold</option>
          <option value="quarterly_threshold">quarterly_threshold</option>
        </select>
        <select style={SEL} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...SEL, flex: 1, minWidth: 200, outline: 'none' }}
        />
      </div>

      {/* Таблица показателей */}
      <div className="cyber-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 40 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Название</th>
              <th style={TH}>Тип</th>
              <th style={TH}>Общий</th>
              <th style={TH}>Статус</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>Ничего не найдено</td></tr>
            ) : filtered.map((ind: any) => (
              <tr key={ind.id}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...TD, fontWeight: 600, maxWidth: 400 }}>{ind.name}</td>
                <td style={TD}>
                  <span style={{
                    background: `${TYPE_COLORS[ind.formula_type] || '#888'}22`,
                    color: TYPE_COLORS[ind.formula_type] || '#888',
                    border: `1px solid ${TYPE_COLORS[ind.formula_type] || '#888'}55`,
                    borderRadius: 6, padding: '2px 10px', fontSize: 11, fontFamily: 'Orbitron, monospace', whiteSpace: 'nowrap',
                  }}>
                    {TYPE_LABELS[ind.formula_type] || ind.formula_type}
                  </span>
                </td>
                <td style={TD}>
                  {ind.is_common && <span className="badge badge-success">Общий</span>}
                </td>
                <td style={TD}>
                  <span className={STATUS_BADGE[ind.status] || 'badge badge-dim'}>{ind.status}</span>
                </td>
                <td style={TD}>
                  <button
                    className="cyber-btn"
                    style={{ padding: '4px 14px', fontSize: 12 }}
                    onClick={() => setSelectedIndicator(ind)}
                  >
                    Просмотр
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── СЕКЦИЯ 2: КАРТОЧКА ДОЛЖНОСТИ ── */}
      <div className="section-title-main" style={{ marginBottom: 16 }}>Карточка должности</div>

      <select
        style={{ ...SEL, minWidth: 300, marginBottom: 24 }}
        value={selectedPosId}
        onChange={e => setSelectedPosId(e.target.value)}
      >
        <option value="">— Выберите должность —</option>
        {cards.map((c: any) => (
          <option key={c.pos_id} value={c.pos_id}>{c.role_name || `pos_id=${c.pos_id}`}</option>
        ))}
      </select>

      {cardLoading && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div className="loader-ring" style={{ margin: '0 auto' }} />
        </div>
      )}

      {!cardLoading && card && (
        <div className="cyber-card fade-up" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,229,255,0.15)' }}>
            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)' }}>
              {card.role_name}
            </span>
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-dim)' }}>
              pos_id={card.pos_id} · v{card.version} · {card.status}
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Показатель</th>
                <th style={TH}>Тип</th>
                <th style={TH}>Общий</th>
                <th style={{ ...TH, textAlign: 'right' }}>Вес</th>
              </tr>
            </thead>
            <tbody>
              {(card.indicators || []).map((ci: any, idx: number) => (
                <tr key={ci.indicator_id ?? idx}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...TD, fontWeight: 600 }}>{ci.indicator_name || '—'}</td>
                  <td style={TD}>
                    {ci.indicator_formula_type && (
                      <span style={{
                        background: `${TYPE_COLORS[ci.indicator_formula_type] || '#888'}22`,
                        color: TYPE_COLORS[ci.indicator_formula_type] || '#888',
                        border: `1px solid ${TYPE_COLORS[ci.indicator_formula_type] || '#888'}55`,
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontFamily: 'Orbitron, monospace',
                      }}>
                        {TYPE_LABELS[ci.indicator_formula_type] || ci.indicator_formula_type}
                      </span>
                    )}
                  </td>
                  <td style={TD}>
                    {ci.is_common && <span className="badge badge-success">Общий</span>}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontFamily: 'Orbitron, monospace', fontSize: 15, fontWeight: 700, color: 'var(--accent3)' }}>
                    {ci.weight}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Итог весов */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text-dim)' }}>
              Сумма весов:
            </span>
            <span style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: 18,
              fontWeight: 700,
              color: totalWeight === 100 ? 'var(--accent3)' : 'var(--danger)',
              textShadow: totalWeight === 100 ? '0 0 10px var(--accent3)' : '0 0 10px var(--danger)',
            }}>
              {totalWeight}%
            </span>
            {totalWeight === 100
              ? <span className="badge badge-success">✓ Верно</span>
              : <span className="badge badge-fail">≠ 100%</span>
            }
          </div>
        </div>
      )}

      {!cardLoading && selectedPosId && !card && (
        <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
          Карточка не найдена
        </div>
      )}

    </div>

      {/* ── МОДАЛЬНОЕ ОКНО ПОКАЗАТЕЛЯ ── */}
      {/* Вынесено за пределы .fade-up: transform на .fade-up создаёт
          новый containing block и ломает position:fixed внутри него */}
      {selectedIndicator && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setSelectedIndicator(null)}
        >
          <div
            className="cyber-card"
            style={{ maxWidth: 640, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: 28, position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedIndicator(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}
            >✕</button>

            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>
              ПОКАЗАТЕЛЬ
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, fontFamily: 'Exo 2, sans-serif', marginBottom: 16, paddingRight: 32 }}>
              {selectedIndicator.name}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <span style={{
                background: `${TYPE_COLORS[selectedIndicator.formula_type] || '#888'}22`,
                color: TYPE_COLORS[selectedIndicator.formula_type] || '#888',
                border: `1px solid ${TYPE_COLORS[selectedIndicator.formula_type] || '#888'}55`,
                borderRadius: 6, padding: '3px 12px', fontSize: 12, fontFamily: 'Orbitron, monospace',
              }}>
                {selectedIndicator.formula_type}
              </span>
              <span className={STATUS_BADGE[selectedIndicator.status] || 'badge badge-dim'}>{selectedIndicator.status}</span>
              {selectedIndicator.is_common && <span className="badge badge-success">Общий</span>}
            </div>

            {selectedIndicator.criteria?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 8 }}>КРИТЕРИЙ ОЦЕНКИ</div>
                {selectedIndicator.criteria.map((cr: any, i: number) => (
                  <div key={i} style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 14, marginBottom: cr.thresholds?.length ? 10 : 0 }}>
                      {cr.criterion}
                    </div>
                    {cr.numerator_label && (
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                        Числитель: {cr.numerator_label}
                        {cr.denominator_label && ` / Знаменатель: ${cr.denominator_label}`}
                      </div>
                    )}
                    {cr.thresholds?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontFamily: 'Orbitron, monospace' }}>ПОРОГИ</div>
                        {cr.thresholds.map((t: any, ti: number) => (
                          <div key={ti} style={{ fontSize: 12, fontFamily: 'Orbitron, monospace', color: 'var(--accent3)', marginBottom: 3 }}>
                            {t.op}{t.value}% → {t.score} баллов
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedIndicator.used_in_cards_count !== undefined && (
              <div style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>
                Используется в{' '}
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{selectedIndicator.used_in_cards_count}</span>
                {' '}карточках
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
