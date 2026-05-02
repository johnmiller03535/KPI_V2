'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { normalizeUnit, buildDeptMap, sortedDeptKeys } from '@/utils/admin'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'periods' | 'employees' | 'subordination' | 'audit' | 'kpi_indicators' | 'kpi'>('overview')
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
    { id: 'kpi_indicators', label: 'KPI-показатели' },
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
              data-tab={tab.id}
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

        {/* ══ ТАБ: KPI-ПОКАЗАТЕЛИ ══ */}
        {activeTab === 'kpi_indicators' && <KpiIndicatorsTab />}

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
  has_kpi_card: boolean
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
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list')
  const [selectedUnit, setSelectedUnit] = useState<string>('__all__')

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
  const withoutCard = inMatrix.filter(e => !e.has_kpi_card)

  // Дедупликация и сортировка подразделений
  const deptMap = buildDeptMap(inMatrix.map(e => ({ unit: e.unit })))
  const topUnitList = sortedDeptKeys(deptMap)

  // Записи для правой части (tree mode)
  const treeEntries =
    selectedUnit === '__all__' ? inMatrix :
    selectedUnit === '__no_card__' ? withoutCard :
    inMatrix.filter(e => normalizeUnit(e.unit || 'Прочие') === selectedUnit)

  // Ряд должности (общий для обоих режимов дерева)
  function EntryRow({ entry }: { entry: SubordinationEntry }) {
    const isEditing = editingId === entry.role_id
    return (
      <div
        style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{entry.role}</span>
            {entry.has_kpi_card
              ? <span className="badge badge-success" style={{ fontSize: 10 }}>✅ карточка</span>
              : <span
                  className="badge badge-warn"
                  style={{ fontSize: 10, cursor: 'pointer' }}
                  onClick={() => {
                    const el = document.querySelector('[data-tab="kpi"]') as HTMLElement
                    if (el) el.click()
                  }}
                >⚠️ нет карточки</span>
            }
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'Orbitron, monospace' }}>{entry.role_id}</div>
          {isEditing ? (
            <select
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              style={{ marginTop: 6, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,229,255,0.35)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '4px 8px', maxWidth: 280 }}
            >
              <option value="">— Директорский уровень —</option>
              {entries.filter(e => e.role_id !== entry.role_id).map(e => (
                <option key={e.role_id} value={e.role_id}>{e.role} ({e.role_id})</option>
              ))}
            </select>
          ) : entry.evaluator_role_id ? (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>→ {entry.evaluator_name || entry.evaluator_role_id}</div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontStyle: 'italic' }}>→ директорский уровень</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
          {isEditing ? (
            <>
              <button className="action-btn btn-fill" style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => handleSave(entry.role_id)} disabled={saving === entry.role_id}>
                {saving === entry.role_id ? '...' : '💾'}
              </button>
              <button className="action-btn btn-view" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setEditingId(null)}>✕</button>
            </>
          ) : (
            <button className="action-btn btn-view" style={{ fontSize: 11, padding: '4px 12px' }}
              onClick={() => { setEditingId(entry.role_id); setEditValue(entry.evaluator_role_id || ''); setSaveResult(null) }}>
              ✏️ Изменить
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up">
      {/* ── Sticky-шапка: заголовок + кнопки + алерты ── */}
      <div style={{ position: 'sticky', top: 64, zIndex: 30, background: 'var(--bg)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
          <div>
            <div className="section-title-main" style={{ margin: 0 }}>Матрица подчинения</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              {inMatrix.length} должностей в матрице · {entries.length} всего в KPI_Mapping
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 0, border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setViewMode('list')}
                style={{ padding: '6px 14px', fontSize: 12, background: viewMode === 'list' ? 'rgba(0,229,255,0.15)' : 'transparent', border: 'none', color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', fontFamily: 'Exo 2, sans-serif' }}>
                ≡ Список
              </button>
              <button onClick={() => setViewMode('tree')}
                style={{ padding: '6px 14px', fontSize: 12, background: viewMode === 'tree' ? 'rgba(0,229,255,0.15)' : 'transparent', border: 'none', color: viewMode === 'tree' ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', fontFamily: 'Exo 2, sans-serif' }}>
                🏢 По подразделениям
              </button>
            </div>
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
          <div className={`alert-banner ${rebuildResult.ok ? 'alert-success' : 'alert-warn'}`} style={{ marginTop: 10, marginBottom: 0 }}>
            {rebuildResult.ok
              ? <span>✅ Импортировано: {rebuildResult.mapped_pairs} пар · файл: {rebuildResult.file?.split('/').pop()}</span>
              : <span>⚠️ {typeof rebuildResult.error === 'object' ? JSON.stringify(rebuildResult.error) : rebuildResult.error}</span>}
          </div>
        )}

        {rebuildResult?.ok && rebuildResult.positions_without_cards?.length > 0 && (
          <div style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.3)', borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600, marginBottom: 6 }}>
              ⚠️ Должности без KPI-карточки ({rebuildResult.positions_without_cards.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rebuildResult.positions_without_cards.map((p: any) => (
                <span key={p.role_id} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '2px 8px' }}>
                  {p.role} ({p.unit})
                </span>
              ))}
            </div>
          </div>
        )}

        {saveResult?.ok && (
          <div className="alert-banner alert-success" style={{ marginTop: 8, marginBottom: 0 }}>✅ Сохранено</div>
        )}
      </div>

      {/* Вид: Список */}
      {viewMode === 'list' && (
        <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 20, background: '#0a0a1a' }}>
                <th style={TH}>Должность</th>
                <th style={TH}>Подразделение</th>
                <th style={TH}>Руководитель</th>
                <th style={TH}>Карточка</th>
                <th style={{ ...TH, width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {inMatrix.map((entry) => (
                <tr key={entry.role_id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={TD}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.role}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'Orbitron, monospace' }}>{entry.role_id}</div>
                  </td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--text-dim)' }}>{entry.unit}</td>
                  <td style={TD}>
                    {editingId === entry.role_id ? (
                      <select value={editValue} onChange={e => setEditValue(e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,229,255,0.35)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '4px 8px', width: '100%', maxWidth: 260 }}>
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
                  <td style={TD}>
                    {entry.has_kpi_card
                      ? <span className="badge badge-success" style={{ fontSize: 10 }}>✅ карточка</span>
                      : <span className="badge badge-warn" style={{ fontSize: 10, cursor: 'pointer' }}
                          onClick={() => { const el = document.querySelector('[data-tab="kpi"]') as HTMLElement; if (el) el.click() }}>
                          ⚠️ нет карточки
                        </span>
                    }
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    {editingId === entry.role_id ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="action-btn btn-fill" style={{ fontSize: 11, padding: '4px 12px' }}
                          onClick={() => handleSave(entry.role_id)} disabled={saving === entry.role_id}>
                          {saving === entry.role_id ? '...' : '💾'}
                        </button>
                        <button className="action-btn btn-view" style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    ) : (
                      <button className="action-btn btn-view" style={{ fontSize: 11, padding: '4px 12px' }}
                        onClick={() => { setEditingId(entry.role_id); setEditValue(entry.evaluator_role_id || ''); setSaveResult(null) }}>
                        ✏️ Изменить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Вид: По подразделениям (двухколоночный layout) */}
      {viewMode === 'tree' && (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
          {/* Левая панель — внутренний скролл */}
          <div className="cyber-card" style={{ width: 260, minWidth: 260, padding: 0, overflowY: 'auto', flexShrink: 0 }}>
            {/* Все должности */}
            <div
              onClick={() => setSelectedUnit('__all__')}
              style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', background: selectedUnit === '__all__' ? 'rgba(0,229,255,0.1)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: 12, color: selectedUnit === '__all__' ? 'var(--accent)' : 'var(--text)', fontFamily: 'Exo 2, sans-serif' }}>Все должности</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace' }}>{inMatrix.length}</span>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            {/* По подразделениям (верхний уровень) */}
            {topUnitList.map(unit => (
              <div key={unit}
                onClick={() => setSelectedUnit(unit)}
                style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: selectedUnit === unit ? 'rgba(0,229,255,0.08)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (selectedUnit !== unit) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (selectedUnit !== unit) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 11, color: selectedUnit === unit ? 'var(--accent)' : 'rgba(255,255,255,0.75)', fontFamily: 'Exo 2, sans-serif', lineHeight: 1.3 }}>{unit}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginLeft: 6, flexShrink: 0 }}>{deptMap.get(unit)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            {/* Без карточки */}
            <div
              onClick={() => setSelectedUnit('__no_card__')}
              style={{ padding: '10px 14px', cursor: 'pointer', background: selectedUnit === '__no_card__' ? 'rgba(255,184,0,0.12)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: 12, color: selectedUnit === '__no_card__' ? 'var(--warn)' : 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>⚠️ Без карточки</span>
              <span style={{ fontSize: 11, color: withoutCard.length > 0 ? 'var(--warn)' : 'var(--text-dim)', fontFamily: 'Orbitron, monospace' }}>{withoutCard.length}</span>
            </div>
          </div>

          {/* Правая часть — внутренний скролл */}
          <div className="cyber-card" style={{ flex: 1, padding: 0, overflowY: 'auto' }}>
            {treeEntries.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                {selectedUnit === '__no_card__' ? '✅ Все должности имеют KPI-карточку' : 'Нет должностей'}
              </div>
            ) : (
              treeEntries.map(entry => <EntryRow key={entry.role_id} entry={entry} />)
            )}
          </div>
        </div>
      )}

      {/* Не в матрице */}
      {notInMatrix.length > 0 && (
        <div style={{ marginTop: 16 }}>
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
  const [cards, setCards] = useState<any[]>([])
  const [allIndicators, setAllIndicators] = useState<any[]>([])
  const [positionsWithoutCards, setPositionsWithoutCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosId, setSelectedPosId] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('all')
  const [card, setCard] = useState<any>(null)
  const [cardLoading, setCardLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedIndicators, setEditedIndicators] = useState<any[]>([])
  const [savingCard, setSavingCard] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addSelected, setAddSelected] = useState<any>(null)
  const [addWeight, setAddWeight] = useState('')
  const [addingSaving, setAddingSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  // Wizard
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState({ role_name: '', pos_id: '', unit: '', copy_mode: 'empty', copy_from_card_id: '' })
  const [wizardSaving, setWizardSaving] = useState(false)
  const [wizardPrefilledPos, setWizardPrefilledPos] = useState<any>(null)

  async function loadCards() {
    const [cds, inds, missing] = await Promise.all([
      api.get('/kpi/cards?status=active').then(r => r.data),
      api.get('/kpi/indicators?status=active').then(r => r.data),
      api.get('/admin/kpi-cards/positions-without-cards').then(r => r.data).catch(() => []),
    ])
    setCards(Array.isArray(cds) ? cds : (cds.items ?? []))
    setAllIndicators(Array.isArray(inds) ? inds : (inds.items ?? []))
    setPositionsWithoutCards(Array.isArray(missing) ? missing : [])
  }

  useEffect(() => {
    loadCards().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedPosId) { setCard(null); setEditMode(false); return }
    setCardLoading(true)
    api.get(`/kpi/cards/${selectedPosId}/active`)
      .then(r => { setCard(r.data); setEditedIndicators([...(r.data.indicators || [])]) })
      .catch(() => setCard(null))
      .finally(() => setCardLoading(false))
  }, [selectedPosId])

  const editedWeight = editedIndicators.reduce((s, ci) => s + (ci.override_weight ?? ci.weight ?? 0), 0)

  // Нормализованная группировка по верхнеуровневым подразделениям
  const kpiDeptMap = buildDeptMap(cards.map((c: any) => ({ unit: c.unit })))
  const kpiDeptKeys = sortedDeptKeys(kpiDeptMap)

  // Cards shown in right panel based on selected unit
  const displayedCards: any[] = selectedUnit === 'all'
    ? cards
    : selectedUnit === 'missing'
    ? []
    : cards.filter((c: any) => normalizeUnit(c.unit || 'Прочие') === selectedUnit)

  const sidebarItemStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    cursor: 'pointer',
    borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
    background: active ? 'rgba(0,229,255,0.06)' : 'transparent',
    color: active ? 'var(--accent)' : 'rgba(232,234,246,0.65)',
    fontFamily: 'Exo 2, sans-serif',
    fontSize: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'all 0.15s',
    borderRadius: '0 6px 6px 0',
  })

  const countBadgeStyle: React.CSSProperties = {
    background: 'rgba(0,229,255,0.12)',
    color: 'var(--accent)',
    borderRadius: 10,
    padding: '1px 7px',
    fontSize: 10,
    fontFamily: 'Orbitron, monospace',
  }

  async function handleSaveCard() {
    if (!card) return
    setSavingCard(true)
    try {
      for (const ci of editedIndicators) {
        await api.put(`/kpi/cards/${card.id}/indicators/${ci.indicator_id}`, {
          weight: ci.weight,
          order_num: ci.order_num,
        })
      }
      const updated = await api.get(`/kpi/cards/${selectedPosId}/active`)
      setCard(updated.data)
      setEditedIndicators([...(updated.data.indicators || [])])
      setEditMode(false)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка сохранения')
    } finally { setSavingCard(false) }
  }

  async function handleAddIndicator() {
    if (!card || !addSelected || !addWeight) return
    setAddingSaving(true)
    try {
      const nextOrder = Math.max(...editedIndicators.map(ci => ci.order_num ?? 0), 0) + 1
      await api.post(`/kpi/cards/${card.id}/indicators`, {
        indicator_id: addSelected.id,
        weight: parseInt(addWeight),
        order_num: nextOrder,
      })
      const updated = await api.get(`/kpi/cards/${selectedPosId}/active`)
      setCard(updated.data)
      setEditedIndicators([...(updated.data.indicators || [])])
      setShowAddModal(false)
      setAddSelected(null)
      setAddWeight('')
      setAddSearch('')
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка добавления')
    } finally { setAddingSaving(false) }
  }

  async function handleRemoveIndicator(indicatorId: string) {
    if (!card) return
    try {
      await api.delete(`/kpi/cards/${card.id}/indicators/${indicatorId}`)
      const updated = await api.get(`/kpi/cards/${selectedPosId}/active`)
      setCard(updated.data)
      setEditedIndicators([...(updated.data.indicators || [])])
      setDeleteConfirm(null)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка удаления')
    }
  }

  function swapOrder(idx: number, dir: -1 | 1) {
    const arr = [...editedIndicators]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= arr.length) return
    const tmp = arr[idx].order_num
    arr[idx] = { ...arr[idx], order_num: arr[swapIdx].order_num }
    arr[swapIdx] = { ...arr[swapIdx], order_num: tmp }
    const sorted = [...arr].sort((a, b) => a.order_num - b.order_num)
    setEditedIndicators(sorted)
  }

  const addFiltered = allIndicators.filter(ind => {
    const alreadyIn = editedIndicators.some(ci => ci.indicator_id === ind.id)
    if (alreadyIn) return false
    if (addSearch && !ind.name.toLowerCase().includes(addSearch.toLowerCase())) return false
    return true
  })

  const totalWeight = card?.total_weight ?? (card?.indicators || []).reduce((s: number, ci: any) => s + (ci.weight || 0), 0)

  function openCreateWizard(prefilledPos?: any) {
    setWizardPrefilledPos(prefilledPos || null)
    setWizardData({
      role_name: prefilledPos?.role || '',
      pos_id: prefilledPos?.pos_id ? String(prefilledPos.pos_id) : '',
      unit: prefilledPos?.unit || '',
      copy_mode: 'empty',
      copy_from_card_id: '',
    })
    setWizardStep(1)
    setShowWizard(true)
  }

  async function handleWizardSave() {
    if (!wizardData.role_name || !wizardData.pos_id) return
    setWizardSaving(true)
    try {
      const posIdNum = parseInt(wizardData.pos_id)
      const roleId = wizardPrefilledPos?.role_id || `POS_${wizardData.pos_id}`
      const payload: any = {
        pos_id: posIdNum,
        role_id: roleId,
        role_name: wizardData.role_name,
        unit: wizardData.unit || undefined,
      }
      if (wizardData.copy_mode === 'copy' && wizardData.copy_from_card_id) {
        payload.copy_from_card_id = wizardData.copy_from_card_id
      }
      await api.post('/admin/kpi-cards/', payload)
      await loadCards()
      setShowWizard(false)
      setSelectedPosId(wizardData.pos_id)
      setSelectedUnit('all')
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка создания карточки')
    } finally { setWizardSaving(false) }
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
      {/* ── Sticky-шапка ── */}
      <div style={{ position: 'sticky', top: 64, zIndex: 30, background: 'var(--bg)', paddingBottom: 10, paddingTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title-main" style={{ margin: 0 }}>Карточки должностей</div>
          <button
            className="cyber-btn"
            style={{ fontSize: 12, padding: '8px 16px', background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)', color: 'var(--accent3)' }}
            onClick={() => openCreateWizard()}
          >
            + Создать карточку
          </button>
        </div>
      </div>

      {/* ── Двухколоночный layout с внутренним скроллом ── */}
      <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
        {/* Левый сайдбар — внутренний скролл */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto' }}>
          <div onClick={() => { setSelectedUnit('all'); setSelectedPosId(''); setCard(null) }} style={sidebarItemStyle(selectedUnit === 'all')}>
            <span>📋 Все карточки</span>
            <span style={countBadgeStyle}>{cards.length}</span>
          </div>
          <div onClick={() => { setSelectedUnit('missing'); setSelectedPosId(''); setCard(null) }} style={sidebarItemStyle(selectedUnit === 'missing')}>
            <span>⚠️ Без карточки</span>
            <span style={{ ...countBadgeStyle, color: 'var(--warn)', background: 'rgba(255,184,0,0.12)' }}>{positionsWithoutCards.length}</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }} />
          {kpiDeptKeys.map(unit => (
            <div key={unit} onClick={() => { setSelectedUnit(unit); setSelectedPosId(''); setCard(null) }} style={sidebarItemStyle(selectedUnit === unit)}>
              <span style={{ fontSize: 11 }}>{unit}</span>
              <span style={countBadgeStyle}>{kpiDeptMap.get(unit)}</span>
            </div>
          ))}
        </div>

        {/* Правая область — внутренний скролл */}
        <div style={{ flex: 1, paddingLeft: 20, overflowY: 'auto' }}>
          {/* Список карточек (когда ни одна не открыта) */}
          {!card && !cardLoading && (
            <div>
              {/* Карточки существующих должностей */}
              {selectedUnit !== 'missing' && displayedCards.map((c: any) => (
                <div
                  key={c.pos_id}
                  className="cyber-card"
                  style={{ marginBottom: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => { setSelectedPosId(String(c.pos_id)); setEditMode(false) }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.role_name || `pos_id=${c.pos_id}`}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'Orbitron, monospace' }}>
                      pos_id={c.pos_id} · v{c.version} · {c.unit || ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={STATUS_BADGE[c.status] || 'badge badge-dim'}>{c.status}</span>
                    <button className="action-btn btn-view" style={{ fontSize: 11, padding: '4px 12px' }} onClick={e => { e.stopPropagation(); setSelectedPosId(String(c.pos_id)); setEditMode(false) }}>
                      Открыть →
                    </button>
                  </div>
                </div>
              ))}

              {/* Должности без карточки */}
              {selectedUnit === 'missing' && (
                positionsWithoutCards.length === 0
                  ? <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--accent3)', padding: 32 }}>✅ У всех должностей есть карточки</div>
                  : positionsWithoutCards.map((p: any) => (
                    <div key={p.pos_id} className="cyber-card" style={{ marginBottom: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'rgba(255,184,0,0.2)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{p.role}</span>
                          <span className="badge badge-warn" style={{ fontSize: 10 }}>⚠️ новая</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'Orbitron, monospace' }}>
                          pos_id={p.pos_id} · {p.unit}
                        </div>
                      </div>
                      <button
                        className="cyber-btn"
                        style={{ fontSize: 12, padding: '6px 14px', background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.4)', color: 'var(--warn)' }}
                        onClick={() => openCreateWizard(p)}
                      >
                        + Создать карточку →
                      </button>
                    </div>
                  ))
              )}

              {selectedUnit !== 'missing' && displayedCards.length === 0 && (
                <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                  Нет карточек
                </div>
              )}
            </div>
          )}

          {cardLoading && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div className="loader-ring" style={{ margin: '0 auto' }} />
            </div>
          )}

          {!cardLoading && card && (
            <div>
              <button
                onClick={() => { setCard(null); setSelectedPosId(''); setEditMode(false) }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontFamily: 'Exo 2, sans-serif', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                ← Назад к списку
              </button>
              <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)' }}>
                      {card.role_name}
                    </span>
                    <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-dim)' }}>
                      pos_id={card.pos_id} · v{card.version} · {card.status}
                      {card.unit && ` · ${card.unit}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editMode ? (
                      <>
                        <button className="action-btn btn-fill" style={{ fontSize: 12 }} onClick={handleSaveCard} disabled={savingCard}>
                          {savingCard ? '...' : '💾 Сохранить'}
                        </button>
                        <button className="action-btn btn-view" style={{ fontSize: 12 }} onClick={() => { setEditMode(false); setEditedIndicators([...(card.indicators || [])]) }}>
                          ✕ Отмена
                        </button>
                        <button className="cyber-btn" style={{ fontSize: 12, padding: '4px 12px', background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)', color: 'var(--accent3)' }} onClick={() => setShowAddModal(true)}>
                          + Добавить показатель
                        </button>
                      </>
                    ) : (
                      <button className="action-btn btn-view" style={{ fontSize: 12 }} onClick={() => setEditMode(true)}>
                        ✏️ Редактировать
                      </button>
                    )}
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {editMode && <th style={{ ...TH, width: 64 }}></th>}
                      <th style={TH}>Показатель</th>
                      <th style={TH}>Тип</th>
                      <th style={TH}>Общий</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Вес</th>
                      {editMode && <th style={{ ...TH, width: 40 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(editMode ? editedIndicators : (card.indicators || [])).map((ci: any, idx: number) => (
                      <tr key={ci.indicator_id ?? idx}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {editMode && (
                          <td style={{ ...TD, width: 64 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <button onClick={() => swapOrder(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, lineHeight: 1, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                              <button onClick={() => swapOrder(idx, 1)} disabled={idx === editedIndicators.length - 1} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, lineHeight: 1, opacity: idx === editedIndicators.length - 1 ? 0.3 : 1 }}>▼</button>
                            </div>
                          </td>
                        )}
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
                        <td style={{ ...TD, textAlign: 'right' }}>
                          {editMode ? (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={ci.weight}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 0
                                setEditedIndicators(prev => prev.map((x, i) => i === idx ? { ...x, weight: val } : x))
                              }}
                              style={{ width: 60, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 6, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', fontSize: 14, fontWeight: 700, padding: '4px 8px', textAlign: 'right' }}
                            />
                          ) : (
                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 15, fontWeight: 700, color: 'var(--accent3)' }}>
                              {ci.weight}%
                            </span>
                          )}
                        </td>
                        {editMode && (
                          <td style={{ ...TD, width: 40 }}>
                            {!ci.is_common && (
                              deleteConfirm === ci.indicator_id ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => handleRemoveIndicator(ci.indicator_id)} style={{ background: 'rgba(255,59,92,0.15)', border: '1px solid var(--danger)', borderRadius: 4, color: 'var(--danger)', cursor: 'pointer', fontSize: 10, padding: '2px 6px' }}>Да</button>
                                  <button onClick={() => setDeleteConfirm(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10, padding: '2px 6px' }}>Нет</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteConfirm(ci.indicator_id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, lineHeight: 1, opacity: 0.7 }}>🗑</button>
                              )
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text-dim)' }}>Сумма весов:</span>
                  <span style={{
                    fontFamily: 'Orbitron, monospace', fontSize: 18, fontWeight: 700,
                    color: (editMode ? editedWeight : totalWeight) === 100 ? 'var(--accent3)' : 'var(--danger)',
                    textShadow: (editMode ? editedWeight : totalWeight) === 100 ? '0 0 10px var(--accent3)' : '0 0 10px var(--danger)',
                  }}>
                    {editMode ? editedWeight : totalWeight}%
                  </span>
                  {(editMode ? editedWeight : totalWeight) === 100
                    ? <span className="badge badge-success">✓ Верно</span>
                    : <span className="badge badge-fail">≠ 100%</span>
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── МОДАЛЬНОЕ ОКНО: ДОБАВИТЬ ПОКАЗАТЕЛЬ ── */}
    {showAddModal && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={e => { if (e.target === e.currentTarget) { setShowAddModal(false); setAddSelected(null); setAddSearch(''); setAddWeight('') } }}
      >
        <div className="cyber-card" style={{ maxWidth: 560, width: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)' }}>ДОБАВИТЬ ПОКАЗАТЕЛЬ</div>
            <button onClick={() => { setShowAddModal(false); setAddSelected(null); setAddSearch(''); setAddWeight('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            <input
              type="text"
              placeholder="Поиск показателя..."
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none' }}
            />
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {addFiltered.map(ind => (
                <div
                  key={ind.id}
                  onClick={() => setAddSelected(ind)}
                  style={{
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    background: addSelected?.id === ind.id ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: addSelected?.id === ind.id ? '1px solid rgba(0,229,255,0.4)' : '1px solid transparent',
                    fontFamily: 'Exo 2, sans-serif', fontSize: 13,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{ind.name}</div>
                  <div style={{ fontSize: 11, color: TYPE_COLORS[ind.formula_type] || '#888', fontFamily: 'Orbitron, monospace' }}>
                    {TYPE_LABELS[ind.formula_type] || ind.formula_type}
                    {ind.is_common && ' · Общий'}
                  </div>
                </div>
              ))}
              {addFiltered.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24, fontSize: 13 }}>Нет доступных показателей</div>
              )}
            </div>
            {addSelected && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif', whiteSpace: 'nowrap' }}>Вес (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={addWeight}
                  onChange={e => setAddWeight(e.target.value)}
                  placeholder="0"
                  style={{ width: 80, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 8, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', fontSize: 15, padding: '6px 10px', outline: 'none' }}
                />
                <button
                  className="action-btn btn-fill"
                  style={{ fontSize: 12, flex: 1 }}
                  onClick={handleAddIndicator}
                  disabled={addingSaving || !addWeight}
                >
                  {addingSaving ? '...' : '+ Добавить'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── МАСТЕР СОЗДАНИЯ КАРТОЧКИ ── */}
    {showWizard && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={e => { if (e.target === e.currentTarget) setShowWizard(false) }}
      >
        <div className="cyber-card" style={{ maxWidth: 520, width: '100%', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          {/* Шапка */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)' }}>НОВАЯ KPI-КАРТОЧКА</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Шаг {wizardStep} из 2</div>
            </div>
            <button onClick={() => setShowWizard(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {wizardStep === 1 && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>НАЗВАНИЕ ДОЛЖНОСТИ *</label>
                  <textarea
                    rows={2}
                    value={wizardData.role_name}
                    onChange={e => setWizardData(d => ({ ...d, role_name: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>POS_ID *</label>
                    <input
                      type="number"
                      value={wizardData.pos_id}
                      onChange={e => setWizardData(d => ({ ...d, pos_id: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', fontSize: 14, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ПОДРАЗДЕЛЕНИЕ</label>
                    <select
                      value={wizardData.unit}
                      onChange={e => setWizardData(d => ({ ...d, unit: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, cursor: 'pointer', boxSizing: 'border-box' }}
                    >
                      <option value="">— не указано —</option>
                      {Object.keys(cardsByUnit).sort().map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {wizardStep === 2 && (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif', marginBottom: 8 }}>
                  Карточка для: <strong style={{ color: 'var(--text)' }}>{wizardData.role_name}</strong> (pos_id={wizardData.pos_id})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, border: `1px solid ${wizardData.copy_mode === 'empty' ? 'rgba(0,229,255,0.4)' : 'rgba(255,255,255,0.1)'}`, background: wizardData.copy_mode === 'empty' ? 'rgba(0,229,255,0.06)' : 'transparent', cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13 }}>
                    <input type="radio" name="copy_mode" value="empty" checked={wizardData.copy_mode === 'empty'} onChange={() => setWizardData(d => ({ ...d, copy_mode: 'empty' }))} />
                    Пустая карточка
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, border: `1px solid ${wizardData.copy_mode === 'copy' ? 'rgba(0,229,255,0.4)' : 'rgba(255,255,255,0.1)'}`, background: wizardData.copy_mode === 'copy' ? 'rgba(0,229,255,0.06)' : 'transparent', cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13 }}>
                    <input type="radio" name="copy_mode" value="copy" checked={wizardData.copy_mode === 'copy'} onChange={() => setWizardData(d => ({ ...d, copy_mode: 'copy' }))} />
                    Скопировать из существующей карточки
                  </label>
                </div>
                {wizardData.copy_mode === 'copy' && (
                  <select
                    value={wizardData.copy_from_card_id}
                    onChange={e => setWizardData(d => ({ ...d, copy_from_card_id: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="">— Выберите карточку-источник —</option>
                    {cards.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.role_name} (pos={c.pos_id})</option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {wizardStep === 1 ? (
              <>
                <button className="action-btn btn-view" style={{ fontSize: 13 }} onClick={() => setShowWizard(false)}>Отмена</button>
                <button
                  className="action-btn btn-fill"
                  style={{ fontSize: 13 }}
                  onClick={() => setWizardStep(2)}
                  disabled={!wizardData.role_name || !wizardData.pos_id}
                >
                  Далее →
                </button>
              </>
            ) : (
              <>
                <button className="action-btn btn-view" style={{ fontSize: 13 }} onClick={() => setWizardStep(1)}>← Назад</button>
                <button
                  className="action-btn btn-fill"
                  style={{ fontSize: 13 }}
                  onClick={handleWizardSave}
                  disabled={wizardSaving || (wizardData.copy_mode === 'copy' && !wizardData.copy_from_card_id)}
                >
                  {wizardSaving ? '...' : '✓ Создать карточку'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ════════════════════════════════════════════════════════════════════
// KPI-ПОКАЗАТЕЛИ TAB
// ════════════════════════════════════════════════════════════════════

const INDICATOR_GROUPS_LIST = [
  { id: 'all', label: '📋 Все' },
  { id: 'Общие показатели', label: '⭐ Общие показатели' },
  { id: 'Проектная деятельность', label: '🏗 Проектная деятельность' },
  { id: 'Аналитическая деятельность', label: '📊 Аналитическая деятельность' },
  { id: 'Закупочная деятельность', label: '🛒 Закупочная деятельность' },
  { id: 'Правовое обеспечение', label: '⚖️ Правовое обеспечение' },
  { id: 'Документооборот', label: '📄 Документооборот' },
  { id: 'Информационные технологии', label: '💻 Информационные технологии' },
  { id: 'Организационное обеспечение', label: '🏢 Организационное обеспечение' },
  { id: 'Прочие показатели', label: '📌 Прочие показатели' },
]

function KpiIndicatorsTab() {
  const [indicators, setIndicators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState('all')
  const [search, setSearch] = useState('')
  const [editingIndicator, setEditingIndicator] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', formula_type: 'binary_manual', indicator_group: 'Прочие показатели', is_common: false, criterion: '', numerator_label: '', denominator_label: '', cumulative: false })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.get('/kpi/indicators?status=all')
      .then(r => setIndicators(Array.isArray(r.data) ? r.data : (r.data.items ?? [])))
      .finally(() => setLoading(false))
  }, [])

  const groupCounts: Record<string, number> = { all: indicators.length }
  for (const g of INDICATOR_GROUPS_LIST.slice(1)) {
    groupCounts[g.id] = indicators.filter(ind => (ind.indicator_group || 'Прочие показатели') === g.id).length
  }

  const filtered = indicators.filter(ind => {
    if (activeGroup !== 'all' && (ind.indicator_group || 'Прочие показатели') !== activeGroup) return false
    if (search && !ind.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openEdit(ind: any) {
    const cr = ind.criteria?.[0] || {}
    setEditForm({
      name: ind.name,
      indicator_group: ind.indicator_group || 'Прочие показатели',
      criterion: cr.criterion || '',
      numerator_label: cr.numerator_label || '',
      denominator_label: cr.denominator_label || '',
      cumulative: cr.cumulative || false,
      thresholds: cr.thresholds ? JSON.stringify(cr.thresholds, null, 2) : '',
      quarterly_thresholds: cr.quarterly_thresholds ? JSON.stringify(cr.quarterly_thresholds, null, 2) : '',
      common_text_positive: cr.common_text_positive || '',
      common_text_negative: cr.common_text_negative || '',
    })
    setEditingIndicator(ind)
  }

  async function handleSave() {
    if (!editingIndicator) return
    setSaving(true)
    try {
      let thresholds = undefined
      if (editForm.thresholds) {
        try { thresholds = JSON.parse(editForm.thresholds) } catch { thresholds = undefined }
      }
      let quarterly_thresholds = undefined
      if (editForm.quarterly_thresholds) {
        try { quarterly_thresholds = JSON.parse(editForm.quarterly_thresholds) } catch { quarterly_thresholds = undefined }
      }
      const payload: any = {
        indicator_group: editForm.indicator_group,
        criterion: editForm.criterion || undefined,
        numerator_label: editForm.numerator_label || undefined,
        denominator_label: editForm.denominator_label || undefined,
        cumulative: editForm.cumulative,
        common_text_positive: editForm.common_text_positive || undefined,
        common_text_negative: editForm.common_text_negative || undefined,
      }
      if (thresholds) payload.thresholds = thresholds
      if (quarterly_thresholds) payload.quarterly_thresholds = quarterly_thresholds
      // Only include name if indicator is draft
      if (editingIndicator.status === 'draft') {
        payload.name = editForm.name
      }
      const res = await api.put(`/kpi/indicators/${editingIndicator.id}`, payload)
      setIndicators(prev => prev.map(ind => ind.id === editingIndicator.id ? res.data : ind))
      setEditingIndicator(null)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  async function handleCreate() {
    if (!createForm.name || !createForm.criterion) return
    setCreating(true)
    try {
      const payload: any = {
        name: createForm.name,
        formula_type: createForm.formula_type,
        indicator_group: createForm.indicator_group,
        is_common: createForm.is_common,
        criterion: createForm.criterion,
      }
      if (['threshold', 'multi_threshold', 'quarterly_threshold'].includes(createForm.formula_type)) {
        if (createForm.numerator_label) payload.numerator_label = createForm.numerator_label
        if (createForm.denominator_label) payload.denominator_label = createForm.denominator_label
        payload.cumulative = createForm.cumulative
      }
      const res = await api.post('/kpi/indicators', payload)
      setIndicators(prev => [res.data, ...prev])
      setShowCreateModal(false)
      setCreateForm({ name: '', formula_type: 'binary_manual', indicator_group: 'Прочие показатели', is_common: false, criterion: '', numerator_label: '', denominator_label: '', cumulative: false })
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка создания')
    } finally { setCreating(false) }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64 }}>
      <div className="loader-ring" style={{ margin: '0 auto' }} />
      <p className="loader-text" style={{ marginTop: 20 }}>ЗАГРУЗКА...</p>
    </div>
  )

  const isNumericType = ['threshold', 'multi_threshold', 'quarterly_threshold'].includes(editingIndicator?.formula_type)
  const isBinaryType = ['binary_auto', 'binary_manual'].includes(editingIndicator?.formula_type)

  return (
    <>
    <div className="fade-up">
      <div style={{ display: 'flex', gap: 0, minHeight: 600 }}>
        {/* Сайдбар групп */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', paddingRight: 0 }}>
          {INDICATOR_GROUPS_LIST.map(g => (
            <div
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                borderLeft: activeGroup === g.id ? '3px solid var(--accent)' : '3px solid transparent',
                background: activeGroup === g.id ? 'rgba(0,229,255,0.06)' : 'transparent',
                color: activeGroup === g.id ? 'var(--accent)' : 'rgba(232,234,246,0.65)',
                fontFamily: 'Exo 2, sans-serif',
                fontSize: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.15s',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <span>{g.label}</span>
              <span style={{
                background: activeGroup === g.id ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.06)',
                color: activeGroup === g.id ? 'var(--accent)' : 'var(--text-dim)',
                borderRadius: 10, padding: '1px 7px', fontSize: 10,
                fontFamily: 'Orbitron, monospace',
              }}>
                {groupCounts[g.id] ?? 0}
              </span>
            </div>
          ))}
        </div>

        {/* Основная область */}
        <div style={{ flex: 1, paddingLeft: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.25)',
                borderRadius: 8, color: 'var(--text)', padding: '8px 14px',
                fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none',
              }}
            />
            <button
              className="cyber-btn"
              style={{ fontSize: 12, padding: '8px 16px', background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)', color: 'var(--accent3)', whiteSpace: 'nowrap' }}
              onClick={() => setShowCreateModal(true)}
            >
              + Добавить показатель
            </button>
          </div>

          <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Название</th>
                  <th style={TH}>Тип</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Используется</th>
                  <th style={TH}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ ...TD, textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                      Ничего не найдено
                    </td>
                  </tr>
                ) : filtered.map((ind: any) => (
                  <tr key={ind.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...TD, fontWeight: 600, maxWidth: 380 }}>
                      <div>{ind.name}</div>
                      {ind.is_common && <span style={{ fontSize: 10, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace' }}>ОБЩИЙ</span>}
                    </td>
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
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'Orbitron, monospace', fontSize: 13, color: ind.used_in_cards_count > 0 ? 'var(--accent3)' : 'var(--text-dim)' }}>
                      {ind.used_in_cards_count ?? 0}
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <button
                        className="action-btn btn-view"
                        style={{ fontSize: 11, padding: '4px 10px', marginRight: 6 }}
                        onClick={() => setEditingIndicator({ ...ind, _viewOnly: true })}
                      >
                        Просмотр
                      </button>
                      <button
                        className="action-btn btn-fill"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => openEdit(ind)}
                      >
                        Редактировать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    {/* ── МОДАЛЬНОЕ ОКНО: ПРОСМОТР (viewOnly) ── */}
    {editingIndicator?._viewOnly && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={() => setEditingIndicator(null)}
      >
        <div
          className="cyber-card"
          style={{ maxWidth: 640, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: 28, position: 'relative' }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => setEditingIndicator(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}>✕</button>
          <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>ПОКАЗАТЕЛЬ</div>
          <div style={{ fontWeight: 700, fontSize: 17, fontFamily: 'Exo 2, sans-serif', marginBottom: 16, paddingRight: 32 }}>{editingIndicator.name}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{
              background: `${TYPE_COLORS[editingIndicator.formula_type] || '#888'}22`,
              color: TYPE_COLORS[editingIndicator.formula_type] || '#888',
              border: `1px solid ${TYPE_COLORS[editingIndicator.formula_type] || '#888'}55`,
              borderRadius: 6, padding: '3px 12px', fontSize: 12, fontFamily: 'Orbitron, monospace',
            }}>{editingIndicator.formula_type}</span>
            <span className={STATUS_BADGE[editingIndicator.status] || 'badge badge-dim'}>{editingIndicator.status}</span>
            {editingIndicator.is_common && <span className="badge badge-success">Общий</span>}
            {editingIndicator.indicator_group && <span className="badge badge-info">{editingIndicator.indicator_group}</span>}
          </div>
          {editingIndicator.criteria?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 8 }}>КРИТЕРИЙ ОЦЕНКИ</div>
              {editingIndicator.criteria.map((cr: any, i: number) => (
                <div key={i} style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 14, marginBottom: 8 }}>{cr.criterion}</div>
                  {cr.numerator_label && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Числитель: {cr.numerator_label}{cr.denominator_label && ` / Знаменатель: ${cr.denominator_label}`}</div>}
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
          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>
            Используется в <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{editingIndicator.used_in_cards_count}</span> карточках
          </div>
        </div>
      </div>
    )}

    {/* ── МОДАЛЬНОЕ ОКНО: РЕДАКТИРОВАНИЕ ── */}
    {editingIndicator && !editingIndicator._viewOnly && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={e => { if (e.target === e.currentTarget) setEditingIndicator(null) }}
      >
        <div
          className="cyber-card"
          style={{ maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, position: 'relative' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Шапка модала */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)' }}>РЕДАКТИРОВАТЬ ПОКАЗАТЕЛЬ</div>
            <button onClick={() => setEditingIndicator(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Название */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>НАЗВАНИЕ</label>
              {editingIndicator.status === 'draft' ? (
                <textarea
                  rows={2}
                  value={editForm.name}
                  onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              ) : (
                <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--text)', padding: '8px 0' }}>{editingIndicator.name}</div>
              )}
            </div>

            {/* Тип (read-only) и Общий */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ТИП</label>
                <span style={{
                  background: `${TYPE_COLORS[editingIndicator.formula_type] || '#888'}22`,
                  color: TYPE_COLORS[editingIndicator.formula_type] || '#888',
                  border: `1px solid ${TYPE_COLORS[editingIndicator.formula_type] || '#888'}55`,
                  borderRadius: 6, padding: '4px 14px', fontSize: 12, fontFamily: 'Orbitron, monospace',
                }}>
                  {editingIndicator.formula_type}
                </span>
              </div>
              {editingIndicator.is_common && (
                <div style={{ paddingTop: 20 }}>
                  <span className="badge badge-success">Общий показатель</span>
                </div>
              )}
            </div>

            {/* Группа */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ГРУППА</label>
              <select
                value={editForm.indicator_group}
                onChange={e => setEditForm((f: any) => ({ ...f, indicator_group: e.target.value }))}
                style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, width: '100%', cursor: 'pointer' }}
              >
                {INDICATOR_GROUPS_LIST.filter(g => g.id !== 'all').map(g => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>

            {/* Критерий */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>КРИТЕРИЙ ОЦЕНКИ</label>
              <textarea
                rows={3}
                value={editForm.criterion}
                onChange={e => setEditForm((f: any) => ({ ...f, criterion: e.target.value }))}
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Числитель / Знаменатель / Нарастающим — для числовых типов */}
            {isNumericType && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ЧИСЛИТЕЛЬ</label>
                    <input
                      value={editForm.numerator_label}
                      onChange={e => setEditForm((f: any) => ({ ...f, numerator_label: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ЗНАМЕНАТЕЛЬ</label>
                    <input
                      value={editForm.denominator_label}
                      onChange={e => setEditForm((f: any) => ({ ...f, denominator_label: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={editForm.cumulative}
                    onChange={e => setEditForm((f: any) => ({ ...f, cumulative: e.target.checked }))}
                  />
                  Нарастающим итогом
                </label>
              </>
            )}

            {/* Пороги — для threshold / multi_threshold */}
            {(editingIndicator?.formula_type === 'threshold' || editingIndicator?.formula_type === 'multi_threshold') && (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ПОРОГИ (JSON)</label>
                <textarea
                  rows={5}
                  value={editForm.thresholds}
                  onChange={e => setEditForm((f: any) => ({ ...f, thresholds: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--accent3)', padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Квартальные пороги */}
            {editingIndicator?.formula_type === 'quarterly_threshold' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>КВАРТАЛЬНЫЕ ПОРОГИ (JSON)</label>
                <textarea
                  rows={6}
                  value={editForm.quarterly_thresholds}
                  onChange={e => setEditForm((f: any) => ({ ...f, quarterly_thresholds: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--accent3)', padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Тексты при выполнении / невыполнении — для binary + is_common */}
            {isBinaryType && editingIndicator?.is_common && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ТЕКСТ ПРИ ВЫПОЛНЕНИИ</label>
                  <textarea
                    rows={2}
                    value={editForm.common_text_positive}
                    onChange={e => setEditForm((f: any) => ({ ...f, common_text_positive: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(0,255,157,0.04)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--danger)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ТЕКСТ ПРИ НЕВЫПОЛНЕНИИ</label>
                  <textarea
                    rows={2}
                    value={editForm.common_text_negative}
                    onChange={e => setEditForm((f: any) => ({ ...f, common_text_negative: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,59,92,0.04)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Кнопки */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--card)' }}>
            <button className="action-btn btn-view" style={{ fontSize: 13 }} onClick={() => setEditingIndicator(null)}>
              Отмена
            </button>
            <button className="action-btn btn-fill" style={{ fontSize: 13 }} onClick={handleSave} disabled={saving}>
              {saving ? '...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── МОДАЛЬНОЕ ОКНО: СОЗДАТЬ ПОКАЗАТЕЛЬ ── */}
    {showCreateModal && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false) }}
      >
        <div
          className="cyber-card"
          style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, position: 'relative' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent3)' }}>НОВЫЙ ПОКАЗАТЕЛЬ</div>
            <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Тип */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ТИП *</label>
              <select
                value={createForm.formula_type}
                onChange={e => setCreateForm(f => ({ ...f, formula_type: e.target.value }))}
                style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, width: '100%', cursor: 'pointer' }}
              >
                {Object.entries(TYPE_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl} ({val})</option>
                ))}
              </select>
            </div>

            {/* Название */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>НАЗВАНИЕ *</label>
              <textarea
                rows={2}
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Группа + Общий */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ГРУППА</label>
                <select
                  value={createForm.indicator_group}
                  onChange={e => setCreateForm(f => ({ ...f, indicator_group: e.target.value }))}
                  style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, width: '100%', cursor: 'pointer' }}
                >
                  {INDICATOR_GROUPS_LIST.filter(g => g.id !== 'all').map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text)', paddingBottom: 8, whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={createForm.is_common}
                  onChange={e => setCreateForm(f => ({ ...f, is_common: e.target.checked }))}
                />
                Общий показатель
              </label>
            </div>

            {/* Критерий */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>КРИТЕРИЙ ОЦЕНКИ *</label>
              <textarea
                rows={3}
                value={createForm.criterion}
                onChange={e => setCreateForm(f => ({ ...f, criterion: e.target.value }))}
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Числовые поля — только для threshold типов */}
            {['threshold', 'multi_threshold', 'quarterly_threshold'].includes(createForm.formula_type) && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ЧИСЛИТЕЛЬ</label>
                    <input
                      value={createForm.numerator_label}
                      onChange={e => setCreateForm(f => ({ ...f, numerator_label: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ЗНАМЕНАТЕЛЬ</label>
                    <input
                      value={createForm.denominator_label}
                      onChange={e => setCreateForm(f => ({ ...f, denominator_label: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={createForm.cumulative}
                    onChange={e => setCreateForm(f => ({ ...f, cumulative: e.target.checked }))}
                  />
                  Нарастающим итогом
                </label>
              </>
            )}
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--card)' }}>
            <button className="action-btn btn-view" style={{ fontSize: 13 }} onClick={() => setShowCreateModal(false)}>
              Отмена
            </button>
            <button
              className="action-btn btn-fill"
              style={{ fontSize: 13 }}
              onClick={handleCreate}
              disabled={creating || !createForm.name || !createForm.criterion}
            >
              {creating ? '...' : '+ Создать показатель'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
