'use client'

import React, { useState, useEffect, useRef } from 'react'
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
  multi_binary: 'Мульти-бинарный',
  threshold: 'Порог',
  multi_threshold: 'Мульти-порог',
  quarterly_threshold: 'Квартальный',
  absolute_threshold: 'Абсолютный',
}

const TYPE_COLORS: Record<string, string> = {
  binary_auto: 'var(--accent)',
  binary_manual: 'var(--warn)',
  multi_binary: '#ff6b9d',
  threshold: 'var(--accent3)',
  multi_threshold: '#b4a0ff',
  quarterly_threshold: '#ff8c00',
  absolute_threshold: '#ff9500',
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
  const [viewIndId, setViewIndId] = useState<string | null>(null)
  const [addGroupFilter, setAddGroupFilter] = useState('')
  const [addUnitFilter, setAddUnitFilter] = useState('')
  const [syncingCommon, setSyncingCommon] = useState(false)
  // Wizard
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState({ role_name: '', pos_id: '', unit: '', copy_mode: 'empty', copy_from_card_id: '' })
  const [wizardSaving, setWizardSaving] = useState(false)
  const [wizardPrefilledPos, setWizardPrefilledPos] = useState<any>(null)
  const [wizardCreatedMsg, setWizardCreatedMsg] = useState('')
  // Wizard step 1: иерархический выбор должности
  const [allSubEntries, setAllSubEntries] = useState<any[]>([])
  const [wizardUnit, setWizardUnit] = useState('')
  const [wizardPosition, setWizardPosition] = useState<any>(null)

  async function loadCards() {
    const [cds, inds, missing, subData] = await Promise.all([
      api.get('/kpi/cards?status=active').then(r => r.data),
      api.get('/kpi/indicators?status=active').then(r => r.data),
      api.get('/admin/kpi-cards/positions-without-cards').then(r => r.data).catch(() => []),
      api.get('/admin/subordination').then(r => r.data).catch(() => []),
    ])
    setCards(Array.isArray(cds) ? cds : (cds.items ?? []))
    setAllIndicators(Array.isArray(inds) ? inds : (inds.items ?? []))
    setPositionsWithoutCards(Array.isArray(missing) ? missing : [])
    setAllSubEntries(Array.isArray(subData) ? subData : [])
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
  const cardsByUnit = cards.reduce((acc: Record<string, any[]>, c: any) => {
    const u = c.unit || 'Без подразделения'
    if (!acc[u]) acc[u] = []
    acc[u].push(c)
    return acc
  }, {})

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
      const specificInds = editedIndicators.filter((ci: any) => !ci.is_common)
      const nextOrder = specificInds.length > 0
        ? Math.max(...specificInds.map((ci: any) => ci.order_num ?? 0)) + 1
        : 1
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
      setAddGroupFilter('')
      setAddUnitFilter('')
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

  function swapOrder(indicatorId: string, dir: -1 | 1) {
    const sorted = [...editedIndicators].sort((a: any, b: any) => {
      if (a.is_common !== b.is_common) return a.is_common ? 1 : -1
      return (a.order_num ?? 0) - (b.order_num ?? 0)
    })
    const idx = sorted.findIndex((x: any) => x.indicator_id === indicatorId)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const tmp = sorted[idx].order_num
    sorted[idx] = { ...sorted[idx], order_num: sorted[swapIdx].order_num }
    sorted[swapIdx] = { ...sorted[swapIdx], order_num: tmp }
    setEditedIndicators(sorted)
  }

  const addFiltered = allIndicators.filter(ind => {
    if (addSearch && !ind.name.toLowerCase().includes(addSearch.toLowerCase())) return false
    if (addGroupFilter && (ind.indicator_group || 'Прочие показатели') !== addGroupFilter) return false
    if (addUnitFilter && (ind.unit_name || '') !== addUnitFilter) return false
    return true
  })

  // Уникальные unit_name из активных показателей
  const addUnitOptions = [...new Set(allIndicators.map((i: any) => i.unit_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'))

  const totalWeight = card?.total_weight ?? (card?.indicators || []).reduce((s: number, ci: any) => s + (ci.weight || 0), 0)

  function openCreateWizard(prefilledPos?: any) {
    setWizardPrefilledPos(prefilledPos || null)
    setWizardData({ role_name: '', pos_id: '', unit: '', copy_mode: 'empty', copy_from_card_id: '' })
    setWizardUnit(prefilledPos?.unit ? normalizeUnit(prefilledPos.unit) : '')
    setWizardPosition(prefilledPos || null)
    setWizardStep(1)
    setWizardCreatedMsg('')
    setShowWizard(true)
  }

  async function handleWizardSave() {
    const pos = wizardPosition || wizardPrefilledPos
    if (!pos) return
    setWizardSaving(true)
    try {
      const posIdNum = parseInt(String(pos.pos_id))
      const payload: any = {
        pos_id: posIdNum,
        role_id: pos.role_id || `POS_${posIdNum}`,
        role_name: pos.role || pos.role_name,
        unit: pos.unit || undefined,
      }
      if (wizardData.copy_mode === 'copy' && wizardData.copy_from_card_id) {
        payload.copy_from_card_id = wizardData.copy_from_card_id
      }
      await api.post('/admin/kpi-cards/', payload)
      await loadCards()
      setShowWizard(false)
      setSelectedPosId(String(posIdNum))
      setSelectedUnit('all')
      setWizardCreatedMsg(wizardData.copy_mode === 'copy' ? '' : 'Карточка создана. Автоматически добавлены общие показатели (50%). Добавьте специфические показатели.')
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка создания карточки')
    } finally { setWizardSaving(false) }
  }

  async function handleSyncCommon() {
    if (!card) return
    setSyncingCommon(true)
    try {
      const r = await api.post(`/admin/kpi-cards/${card.pos_id}/sync-common`)
      if (r.data.added > 0) {
        setWizardCreatedMsg(`Добавлено ${r.data.added} общих показателей`)
        // Перезагружаем карточку
        const updated = await api.get(`/kpi/cards/${card.pos_id}/active`)
        setCard(updated.data)
        setEditedIndicators([...(updated.data.indicators || [])])
      } else {
        setWizardCreatedMsg('Все общие показатели уже присутствуют в карточке')
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка синхронизации')
    } finally { setSyncingCommon(false) }
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
                onClick={() => { setCard(null); setSelectedPosId(''); setEditMode(false); setWizardCreatedMsg('') }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontFamily: 'Exo 2, sans-serif', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                ← Назад к списку
              </button>
              {wizardCreatedMsg && (
                <div style={{ marginBottom: 12, padding: '10px 16px', background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)', borderRadius: 8, fontSize: 13, fontFamily: 'Exo 2, sans-serif', color: 'var(--accent3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✅ {wizardCreatedMsg}</span>
                  <button onClick={() => setWizardCreatedMsg('')} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              )}
              <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', paddingBottom: 0 }}>
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
                      <>
                        {/* Кнопка синхронизации общих показателей */}
                        {(() => {
                          const commonIds = allIndicators.filter((i: any) => i.is_common).map((i: any) => i.id)
                          const cardIndIds = (card.indicators || []).map((ci: any) => ci.indicator_id)
                          const hasMissing = commonIds.some((id: string) => !cardIndIds.includes(id))
                          return hasMissing ? (
                            <button
                              className="cyber-btn"
                              style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.3)', color: 'var(--warn)' }}
                              onClick={handleSyncCommon}
                              disabled={syncingCommon}
                            >
                              {syncingCommon ? '...' : '+ Общие показатели'}
                            </button>
                          ) : null
                        })()}
                        <button className="action-btn btn-view" style={{ fontSize: 12 }} onClick={() => setEditMode(true)}>
                          ✏️ Редактировать
                        </button>
                      </>
                    )}
                  </div>
                </div>
                </div>{/* /sticky header */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {editMode && <th style={{ ...TH, width: 64 }}></th>}
                      <th style={TH}>Показатель</th>
                      <th style={TH}>Тип</th>
                      <th style={TH}>Общий</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Вес</th>
                      <th style={{ ...TH, width: 80 }}>Детали</th>
                      {editMode && <th style={{ ...TH, width: 40 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const source = editMode ? editedIndicators : (card.indicators || [])
                      const sorted = [...source].sort((a: any, b: any) => {
                        if (a.is_common !== b.is_common) return a.is_common ? 1 : -1
                        return (a.order_num ?? 0) - (b.order_num ?? 0)
                      })
                      return sorted.map((ci: any, idx: number) => {
                        const prevCi = sorted[idx - 1]
                        const showDivider = idx > 0 && ci.is_common && !prevCi?.is_common
                        return (
                          <React.Fragment key={ci.indicator_id ?? `row-${idx}`}>
                            {showDivider && (
                              <tr>
                                <td colSpan={editMode ? 7 : 5} style={{ padding: '4px 20px', background: 'rgba(0,229,255,0.04)', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', letterSpacing: 1 }}>
                                  ОБЩИЕ ПОКАЗАТЕЛИ
                                </td>
                              </tr>
                            )}
                            <tr
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                        {editMode && (
                          <td style={{ ...TD, width: 64 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <button onClick={() => swapOrder(ci.indicator_id, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, lineHeight: 1, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                              <button onClick={() => swapOrder(ci.indicator_id, 1)} disabled={idx === sorted.length - 1} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, lineHeight: 1, opacity: idx === sorted.length - 1 ? 0.3 : 1 }}>▼</button>
                            </div>
                          </td>
                        )}
                        <td style={{ ...TD, fontWeight: 600 }}>
                          <span>{ci.indicator_name || '—'}</span>
                        </td>
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
                                setEditedIndicators(prev => prev.map((x: any) => x.indicator_id === ci.indicator_id ? { ...x, weight: val } : x))
                              }}
                              style={{ width: 60, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 6, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', fontSize: 14, fontWeight: 700, padding: '4px 8px', textAlign: 'right' }}
                            />
                          ) : (
                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 15, fontWeight: 700, color: 'var(--accent3)' }}>
                              {ci.weight}%
                            </span>
                          )}
                        </td>
                        <td style={{ ...TD, width: 80 }}>
                          <button
                            onClick={() => setViewIndId(ci.indicator_id)}
                            style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontSize: 11, padding: '3px 10px', fontFamily: 'Exo 2, sans-serif', whiteSpace: 'nowrap' }}
                          >
                            👁 Детали
                          </button>
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
                          </React.Fragment>
                        )
                      })
                    })()}
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
        onClick={e => { if (e.target === e.currentTarget) { setShowAddModal(false); setAddSelected(null); setAddSearch(''); setAddWeight(''); setAddGroupFilter(''); setAddUnitFilter('') } }}
      >
        <div className="cyber-card" style={{ maxWidth: 600, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)' }}>ДОБАВИТЬ ПОКАЗАТЕЛЬ</div>
            <button onClick={() => { setShowAddModal(false); setAddSelected(null); setAddSearch(''); setAddWeight(''); setAddGroupFilter(''); setAddUnitFilter('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={addUnitFilter}
                onChange={e => setAddUnitFilter(e.target.value)}
                style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '7px 10px', fontFamily: 'Exo 2, sans-serif', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Все управления</option>
                {addUnitOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select
                value={addGroupFilter}
                onChange={e => setAddGroupFilter(e.target.value)}
                style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '7px 10px', fontFamily: 'Exo 2, sans-serif', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Все группы</option>
                {INDICATOR_GROUPS_LIST.filter(g => g.id !== 'all').map(g => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {addFiltered.map(ind => {
                const alreadyIn = editedIndicators.some(ci => ci.indicator_id === ind.id)
                return (
                <div
                  key={ind.id}
                  onClick={() => !alreadyIn && setAddSelected(ind)}
                  style={{
                    padding: '10px 14px', borderRadius: 8, cursor: alreadyIn ? 'default' : 'pointer',
                    background: addSelected?.id === ind.id ? 'rgba(0,229,255,0.1)' : alreadyIn ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)',
                    border: addSelected?.id === ind.id ? '1px solid rgba(0,229,255,0.4)' : '1px solid transparent',
                    fontFamily: 'Exo 2, sans-serif', fontSize: 13,
                    opacity: alreadyIn ? 0.45 : 1,
                    transition: 'all 0.15s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{ind.name}</div>
                    <div style={{ fontSize: 11, color: TYPE_COLORS[ind.formula_type] || '#888', fontFamily: 'Orbitron, monospace' }}>
                      {TYPE_LABELS[ind.formula_type] || ind.formula_type}
                      {ind.is_common && ' · Общий'}
                      {ind.indicator_group && <span style={{ color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}> · {ind.indicator_group}</span>}
                    </div>
                  </div>
                  {alreadyIn && <span style={{ fontSize: 11, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', whiteSpace: 'nowrap' }}>✓ В карточке</span>}
                </div>
                )
              })}
              {addFiltered.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24, fontSize: 13 }}>Нет показателей</div>
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

    {/* ── ПРОСМОТР ПОКАЗАТЕЛЯ ИЗ КАРТОЧКИ ── */}
    {viewIndId && (
      <IndicatorViewModal
        indicator={allIndicators.find((i: any) => i.id === viewIndId)}
        onClose={() => setViewIndId(null)}
      />
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
            {wizardStep === 1 && (() => {
              // Строим иерархию из allSubEntries
              const unitGroups: Record<string, any[]> = {}
              for (const e of allSubEntries) {
                const u = normalizeUnit(e.unit || 'Прочие')
                if (!unitGroups[u]) unitGroups[u] = []
                unitGroups[u].push(e)
              }
              const unitKeys = Object.keys(unitGroups).sort((a, b) => {
                if (a === 'Руководство') return -1
                if (b === 'Руководство') return 1
                return a.localeCompare(b, 'ru')
              })
              const positionsInUnit = wizardUnit ? (unitGroups[wizardUnit] || []) : []
              // Проверяем есть ли уже карточка у выбранной должности
              const existingCard = wizardPosition
                ? cards.find((c: any) => String(c.pos_id) === String(wizardPosition.pos_id))
                : null
              const SL: React.CSSProperties = { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, cursor: 'pointer', boxSizing: 'border-box' as const, outline: 'none' }
              return (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>УПРАВЛЕНИЕ *</label>
                    <select value={wizardUnit} onChange={e => { setWizardUnit(e.target.value); setWizardPosition(null) }} style={SL}>
                      <option value="">— Выберите управление —</option>
                      {unitKeys.map(u => <option key={u} value={u}>{u} ({unitGroups[u].length})</option>)}
                    </select>
                  </div>

                  {wizardUnit && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ДОЛЖНОСТЬ *</label>
                      <select
                        value={wizardPosition ? String(wizardPosition.pos_id) : ''}
                        onChange={e => {
                          const entry = positionsInUnit.find((p: any) => String(p.pos_id) === e.target.value)
                          setWizardPosition(entry || null)
                        }}
                        style={SL}
                      >
                        <option value="">— Выберите должность —</option>
                        {positionsInUnit.map((p: any) => {
                          const hasCard = cards.some((c: any) => String(c.pos_id) === String(p.pos_id))
                          return <option key={p.pos_id} value={String(p.pos_id)}>{p.role || p.role_name}{hasCard ? ' ✓' : ''}</option>
                        })}
                      </select>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'Exo 2, sans-serif' }}>
                        Должности со значком ✓ уже имеют карточку
                      </div>
                    </div>
                  )}

                  {wizardPosition && (
                    <div style={{
                      padding: '12px 16px', borderRadius: 8,
                      background: existingCard ? 'rgba(255,184,0,0.06)' : 'rgba(0,255,157,0.06)',
                      border: `1px solid ${existingCard ? 'rgba(255,184,0,0.3)' : 'rgba(0,255,157,0.3)'}`,
                    }}>
                      <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        {wizardPosition.role || wizardPosition.role_name}
                      </div>
                      <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                        {wizardPosition.role_id} · {wizardPosition.unit}
                      </div>
                      {existingCard
                        ? <div style={{ color: 'var(--warn)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            ⚠️ Карточка уже существует
                            <button
                              onClick={() => { setShowWizard(false); setSelectedPosId(String(wizardPosition.pos_id)) }}
                              style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(255,184,0,0.15)', border: '1px solid rgba(255,184,0,0.4)', borderRadius: 4, color: 'var(--warn)', cursor: 'pointer' }}
                            >Открыть</button>
                          </div>
                        : <div style={{ color: 'var(--accent3)', fontSize: 12 }}>✓ Карточка ещё не создана</div>
                      }
                    </div>
                  )}
                </>
              )
            })()}

            {wizardStep === 2 && (
              <>
                <div style={{ padding: '10px 14px', background: 'rgba(0,229,255,0.04)', borderRadius: 8, border: '1px solid rgba(0,229,255,0.15)', fontSize: 13, fontFamily: 'Exo 2, sans-serif', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600 }}>{wizardPosition?.role || wizardPosition?.role_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'Orbitron, monospace' }}>
                    {wizardPosition?.role_id} · {wizardPosition?.unit}
                  </div>
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
                  disabled={!wizardPosition || !!cards.find((c: any) => String(c.pos_id) === String(wizardPosition?.pos_id))}
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

const UNIT_LIST = [
  'Руководство',
  'Правовое управление',
  'Управление закупочной деятельности',
  'Управление закупочных процедур',
  'Управление анализа и автоматизации данных',
  'Единая архивная служба',
  'Центр технической разработки',
  'Организационный отдел',
]

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

// ─── TYPE DESCRIPTIONS ────────────────────────────────────────────────────────
const TYPE_DESCRIPTIONS: Record<string, string> = {
  binary_auto: 'AI оценивает автоматически по трудозатратам сотрудника в Redmine',
  binary_manual: 'Руководитель оценивает вручную: ✅ выполнено / ❌ не выполнено',
  multi_binary: 'Руководитель оценивает каждый подпоказатель отдельно — нужно выполнить все',
  threshold: 'Сотрудник вводит факт/план, система считает % и применяет пороги',
  multi_threshold: 'Несколько числовых подпоказателей — нужно выполнить все',
  quarterly_threshold: 'Числовой с разными порогами для каждого квартала',
  absolute_threshold: 'Сотрудник вводит одно число. Система сравнивает его с порогами напрямую (без деления)',
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const INPUT_STYLE: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.25)',
  borderRadius: 8, color: 'var(--text)', padding: '8px 12px',
  fontFamily: 'Exo 2, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--text-dim)',
  fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1,
}
const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE, cursor: 'pointer',
}
const ERROR_STYLE: React.CSSProperties = {
  color: 'var(--danger)', fontSize: 11, marginTop: 4, fontFamily: 'Exo 2, sans-serif',
}

// ─── THRESHOLD RULES EDITOR ───────────────────────────────────────────────────
type ThresholdRule = { operator: string; value: string; score: string }

function ThresholdRulesEditor({ rules, onChange, showPercent = true }: {
  rules: ThresholdRule[]
  onChange: (rules: ThresholdRule[]) => void
  showPercent?: boolean
}) {
  function update(i: number, field: keyof ThresholdRule, val: string) {
    const updated = rules.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    onChange(updated)
  }
  function remove(i: number) { onChange(rules.filter((_, idx) => idx !== i)) }
  function add() { onChange([...rules, { operator: '>=', value: '', score: '' }]) }

  return (
    <div>
      {rules.map((rule, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <select
            value={rule.operator}
            onChange={e => update(i, 'operator', e.target.value)}
            style={{ ...SELECT_STYLE, width: 64, padding: '8px 4px' }}
          >
            {['>=', '>', '<=', '<', '='].map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input
            value={rule.value}
            onChange={e => update(i, 'value', e.target.value)}
            placeholder={showPercent ? '0–100' : 'значение'}
            style={{ ...INPUT_STYLE, width: 80 }}
          />
          <span style={{ color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', fontSize: 12 }}>{showPercent ? '%' : ''} →</span>
          <input
            value={rule.score}
            onChange={e => update(i, 'score', e.target.value)}
            placeholder="балл"
            style={{ ...INPUT_STYLE, width: 70 }}
          />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>🗑</button>
        </div>
      ))}
      <button
        onClick={add}
        style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: '4px 12px', fontFamily: 'Exo 2, sans-serif' }}
      >
        + Добавить правило
      </button>
    </div>
  )
}

// ─── INDICATOR VIEW MODAL ─────────────────────────────────────────────────────
function IndicatorViewModal({ indicator: vi, onClose, onEdit }: {
  indicator: any
  onClose: () => void
  onEdit?: (indicator: any) => void
}) {
  if (!vi) return null
  const isAbsolute = vi.formula_type === 'absolute_threshold'

  function renderThresholds(thresholds: any[]) {
    return thresholds.map((t: any, ti: number) => {
      let op = '', val = ''
      if (t.condition) {
        const m = String(t.condition).match(/^(>=|<=|>|<|==?)(.+)$/)
        op = m?.[1] ?? ''; val = m?.[2] ?? t.condition
      } else {
        op = t.operator ?? ''; val = String(t.value ?? '')
      }
      const suffix = isAbsolute ? '' : '%'
      return (
        <div key={ti} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, fontFamily: 'Orbitron, monospace', color: 'var(--accent3)', marginBottom: 4 }}>
          <span style={{ minWidth: 28, textAlign: 'right', color: 'var(--text-dim)' }}>{op}</span>
          <span style={{ minWidth: 40 }}>{val}{suffix}</span>
          <span style={{ color: 'var(--text-dim)' }}>→</span>
          <span style={{ color: t.score > 0 ? 'var(--accent3)' : 'var(--danger)' }}>{t.score} баллов</span>
        </div>
      )
    })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', overflowY: 'auto', padding: '110px 24px 40px' }}
      onClick={onClose}
    >
      <div className="cyber-card" style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: 0 }} onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,229,255,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--accent)', marginBottom: 8, letterSpacing: 1 }}>ПОКАЗАТЕЛЬ</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Exo 2, sans-serif', marginBottom: 12, lineHeight: 1.4 }}>{vi.name}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: `${TYPE_COLORS[vi.formula_type] || '#888'}22`, color: TYPE_COLORS[vi.formula_type] || '#888', border: `1px solid ${TYPE_COLORS[vi.formula_type] || '#888'}55`, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontFamily: 'Orbitron, monospace' }}>
              {TYPE_LABELS[vi.formula_type] || vi.formula_type}
            </span>
            {vi.status && <span className={STATUS_BADGE[vi.status] || 'badge badge-dim'}>{vi.status}</span>}
            {vi.is_common && <span className="badge badge-success">Общий</span>}
            {vi.indicator_group && <span className="badge badge-info" style={{ fontSize: 11 }}>{vi.indicator_group}</span>}
            {vi.unit_name && <span className="badge badge-dim" style={{ fontSize: 11 }}>🏢 {vi.unit_name}</span>}
          </div>
        </div>

        {vi.criteria?.map((cr: any, i: number) => {
          const isNumeric = ['threshold', 'multi_threshold', 'quarterly_threshold', 'absolute_threshold'].includes(vi.formula_type)
          const crThresholds: any[] = cr.thresholds || []
          const crQThresholds: Record<string, any[]> = cr.quarterly_thresholds || {}

          return (
            <div key={i}>
              {/* КРИТЕРИЙ ОЦЕНКИ — скрываем для multi_binary */}
              {vi.formula_type !== 'multi_binary' && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'Orbitron, monospace', marginBottom: 8, letterSpacing: 1 }}>КРИТЕРИЙ ОЦЕНКИ</div>
                  <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 14, lineHeight: 1.5, color: 'var(--text)' }}>{cr.criterion}</div>
                  {cr.formula_desc && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,229,255,0.03)', borderLeft: '2px solid rgba(0,229,255,0.3)', borderRadius: '0 4px 4px 0', fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
                      💡 {cr.formula_desc}
                    </div>
                  )}
                </div>
              )}

              {/* ЧИСЛОВОЙ ПОКАЗАТЕЛЬ */}
              {isNumeric && (cr.numerator_label || cr.value_label || cr.cumulative) && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'Orbitron, monospace', marginBottom: 8, letterSpacing: 1 }}>ЧИСЛОВОЙ ПОКАЗАТЕЛЬ</div>
                  {isAbsolute
                    ? cr.value_label && <div style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>Поле ввода: <span style={{ color: 'var(--text)' }}>{cr.value_label}</span></div>
                    : <>
                        {cr.numerator_label && <div style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif', marginBottom: 4 }}>Числитель: <span style={{ color: 'var(--text)' }}>{cr.numerator_label}</span></div>}
                        {cr.denominator_label && <div style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>Знаменатель: <span style={{ color: 'var(--text)' }}>{cr.denominator_label}</span></div>}
                      </>
                  }
                  {cr.cumulative && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--accent3)', fontFamily: 'Exo 2, sans-serif' }}>↗ Нарастающим итогом</div>}
                </div>
              )}

              {/* ПОДПОКАЗАТЕЛИ — multi_binary и multi_threshold */}
              {['multi_binary', 'multi_threshold'].includes(vi.formula_type) && cr.sub_indicators?.length > 0 && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
                  <div style={{ fontSize: 11, color: '#ff6b9d', fontFamily: 'Orbitron, monospace', marginBottom: 6, letterSpacing: 1 }}>ПОДПОКАЗАТЕЛИ</div>
                  {vi.formula_type === 'multi_binary' && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif', marginBottom: 10 }}>
                      Руководитель оценивает каждый отдельно. Все должны быть ✅
                    </div>
                  )}
                  {cr.formula_desc && vi.formula_type === 'multi_binary' && (
                    <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(0,229,255,0.03)', borderLeft: '2px solid rgba(0,229,255,0.3)', borderRadius: '0 4px 4px 0', fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
                      💡 {cr.formula_desc}
                    </div>
                  )}
                  {cr.sub_indicators
                    .slice()
                    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                    .map((sub: any, si: number) => (
                      <div key={si} style={{ marginBottom: 8, fontFamily: 'Exo 2, sans-serif', fontSize: 13 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ color: '#ff6b9d', fontFamily: 'Orbitron, monospace', fontSize: 11, minWidth: 20, marginTop: 2 }}>{si + 1}.</span>
                          <span style={{ color: 'var(--text)' }}>{sub.description}</span>
                        </div>
                        {sub.sub_criterion && (
                          <div style={{ paddingLeft: 30, marginTop: 3, color: 'var(--text-dim)', fontSize: 12, fontStyle: 'italic' }}>
                            ↳ {sub.sub_criterion}
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}

              {/* ТЕКСТ В ОТЧЁТЕ */}
              {['binary_manual', 'multi_binary'].includes(vi.formula_type) && (cr.common_text_positive || cr.common_text_negative) && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', marginBottom: 10, letterSpacing: 1 }}>ТЕКСТ В ОТЧЁТЕ</div>
                  {cr.common_text_positive && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontFamily: 'Exo 2, sans-serif', fontSize: 13, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent3)', minWidth: 20 }}>✅</span>
                      <span style={{ color: 'var(--text)' }}>{cr.common_text_positive}</span>
                    </div>
                  )}
                  {cr.common_text_negative && (
                    <div style={{ display: 'flex', gap: 8, fontFamily: 'Exo 2, sans-serif', fontSize: 13, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--danger)', minWidth: 20 }}>❌</span>
                      <span style={{ color: 'var(--text)' }}>{cr.common_text_negative}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ПРАВИЛА ОЦЕНКИ */}
              {['threshold', 'multi_threshold', 'quarterly_threshold', 'absolute_threshold'].includes(vi.formula_type) &&
                (crThresholds.length > 0 || Object.keys(crQThresholds).length > 0) && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'Orbitron, monospace', marginBottom: 10, letterSpacing: 1 }}>ПРАВИЛА ОЦЕНКИ</div>
                  {vi.formula_type === 'quarterly_threshold' && Object.keys(crQThresholds).length > 0
                    ? (['Q1','Q2','Q3','Q4'] as const).map(q => crQThresholds[q]?.length > 0 && (
                        <div key={q} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', marginBottom: 4 }}>{q}</div>
                          {renderThresholds(crQThresholds[q])}
                        </div>
                      ))
                    : renderThresholds(crThresholds)
                  }
                </div>
              )}
            </div>
          )
        })}

        {/* Футер */}
        <div style={{ padding: '14px 24px', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>
            Используется в <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{vi.used_in_cards_count ?? 0}</span> карточках
          </div>
          {onEdit && (
            <button className="action-btn btn-fill" style={{ fontSize: 12 }} onClick={() => onEdit(vi)}>
              Редактировать
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── INDICATOR FORM MODAL ─────────────────────────────────────────────────────
function IndicatorFormModal({ initialData, onClose, onSuccess }: {
  initialData?: any
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!initialData

  // Parse initialData into form state
  const initCr = initialData?.criteria?.[0] || {}
  const initSubBinary = initialData?.formula_type === 'multi_binary' && initCr.sub_indicators
    ? initCr.sub_indicators.map((s: any, i: number) => ({ description: s.description || '', order: s.order ?? i, sub_criterion: s.sub_criterion || '' }))
    : [{ description: '', order: 0, sub_criterion: '' }, { description: '', order: 1, sub_criterion: '' }]

  function parseThresholds(t: any[]): ThresholdRule[] {
    if (!t || !t.length) return [{ operator: '>=', value: '', score: '' }, { operator: '<', value: '', score: '0' }]
    return t.map((r: any) => {
      const cond = r.condition || ''
      const match = cond.match(/^(>=|<=|>|<|=)(.*)$/)
      return { operator: match?.[1] || '>=', value: match?.[2] || '', score: String(r.score ?? '') }
    })
  }

  const initSubThresholds = initialData?.formula_type === 'multi_threshold' && initCr.sub_indicators
    ? initCr.sub_indicators.map((s: any) => ({
        name: s.name || '',
        numerator_label: s.numerator_label || '',
        denominator_label: s.denominator_label || '',
        cumulative: s.cumulative || false,
        thresholds: parseThresholds(s.thresholds),
      }))
    : [
        { name: '', numerator_label: '', denominator_label: '', cumulative: false, thresholds: [{ operator: '>=', value: '', score: '' }, { operator: '<', value: '', score: '0' }] },
        { name: '', numerator_label: '', denominator_label: '', cumulative: false, thresholds: [{ operator: '>=', value: '', score: '' }, { operator: '<', value: '', score: '0' }] },
      ]

  function emptyQThresholds() {
    return { Q1: [{ operator: '>=', value: '', score: '' }, { operator: '<', value: '', score: '0' }], Q2: [{ operator: '>=', value: '', score: '' }, { operator: '<', value: '', score: '0' }], Q3: [{ operator: '>=', value: '', score: '' }, { operator: '<', value: '', score: '0' }], Q4: [{ operator: '>=', value: '', score: '' }, { operator: '<', value: '', score: '0' }] }
  }

  const initQThresholds = initialData?.formula_type === 'quarterly_threshold' && initCr.quarterly_thresholds
    ? { Q1: parseThresholds(initCr.quarterly_thresholds.Q1), Q2: parseThresholds(initCr.quarterly_thresholds.Q2), Q3: parseThresholds(initCr.quarterly_thresholds.Q3), Q4: parseThresholds(initCr.quarterly_thresholds.Q4) }
    : emptyQThresholds()

  const formScrollRef = useRef<HTMLDivElement>(null)
  const [formulaType, setFormulaType] = useState(initialData?.formula_type || '')
  const [name, setName] = useState(initialData?.name || '')
  const [indicatorGroup, setIndicatorGroup] = useState(initialData?.indicator_group || '')
  const [unitName, setUnitName] = useState(initialData?.unit_name || '')
  const [isCommon, setIsCommon] = useState(initialData?.is_common || false)
  const [defaultWeight, setDefaultWeight] = useState(initialData?.default_weight || 0)
  const [positiveText, setPositiveText] = useState(initCr.common_text_positive || '')
  const [negativeText, setNegativeText] = useState(initCr.common_text_negative || '')
  const [criterion, setCriterion] = useState(initCr.criterion || '')
  const [numeratorLabel, setNumeratorLabel] = useState(initCr.numerator_label || '')
  const [denominatorLabel, setDenominatorLabel] = useState(initCr.denominator_label || '')
  const [cumulative, setCumulative] = useState(initCr.cumulative || false)
  const [thresholds, setThresholds] = useState<ThresholdRule[]>(parseThresholds(initCr.thresholds))
  const [subBinaryItems, setSubBinaryItems] = useState(initSubBinary)
  const [subThresholds, setSubThresholds] = useState(initSubThresholds)
  const [quarterlyThresholds, setQuarterlyThresholds] = useState<Record<string, ThresholdRule[]>>(initQThresholds)
  const [activeQuarter, setActiveQuarter] = useState<'Q1'|'Q2'|'Q3'|'Q4'>('Q1')
  const [formulaDesc, setFormulaDesc] = useState(initCr.formula_desc || '')
  const [valueLabel, setValueLabel] = useState(initCr.value_label || '')
  const [isQuarterly, setIsQuarterly] = useState(initCr.is_quarterly || false)
  const [absoluteThresholds, setAbsoluteThresholds] = useState<ThresholdRule[]>(parseThresholds(initCr.thresholds))
  const [absoluteQThresholds, setAbsoluteQThresholds] = useState<Record<string, ThresholdRule[]>>(
    initialData?.formula_type === 'absolute_threshold' && initCr.quarterly_thresholds
      ? { Q1: parseThresholds(initCr.quarterly_thresholds.Q1), Q2: parseThresholds(initCr.quarterly_thresholds.Q2), Q3: parseThresholds(initCr.quarterly_thresholds.Q3), Q4: parseThresholds(initCr.quarterly_thresholds.Q4) }
      : emptyQThresholds()
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!formulaType) e.formulaType = 'Выберите тип показателя'
    if (!name.trim()) e.name = 'Введите название показателя'
    if (!criterion.trim()) e.criterion = 'Опишите критерий оценки'
    if (!indicatorGroup) e.indicatorGroup = 'Выберите группу'

    if (formulaType === 'multi_binary') {
      if (subBinaryItems.length < 2) e.subBinary = 'Добавьте хотя бы 2 подпоказателя'
      else if (subBinaryItems.some((s: any) => !s.description.trim())) e.subBinary = 'Заполните описание каждого подпоказателя'
    }
    if (['threshold', 'multi_threshold', 'quarterly_threshold'].includes(formulaType)) {
      if (formulaType !== 'multi_threshold') {
        if (!numeratorLabel.trim()) e.numerator = 'Укажите что считается в числителе'
        if (!denominatorLabel.trim()) e.denominator = 'Укажите базу для расчёта %'
      }
    }
    if (formulaType === 'threshold') {
      if (!thresholds.length) e.thresholds = 'Добавьте хотя бы одно правило оценки'
      else if (!thresholds.some((r: ThresholdRule) => r.score === '0')) e.thresholds = 'Добавьте правило для минимального балла (0)'
      else if (thresholds.some((r: ThresholdRule) => !r.value || isNaN(parseFloat(r.value)))) e.thresholds = 'Введите числовые значения порогов'
    }
    if (formulaType === 'multi_threshold') {
      if (subThresholds.length < 2) e.subThresholds = 'Добавьте хотя бы 2 числовых подпоказателя'
      else {
        for (const sub of subThresholds) {
          if (!sub.numerator_label.trim()) { e.subThresholds = 'Заполните числитель для каждого подпоказателя'; break }
          if (!sub.denominator_label.trim()) { e.subThresholds = 'Заполните знаменатель для каждого подпоказателя'; break }
          if (!sub.thresholds.length) { e.subThresholds = 'Добавьте правила для каждого подпоказателя'; break }
        }
      }
    }
    if (formulaType === 'quarterly_threshold') {
      for (const q of ['Q1', 'Q2', 'Q3', 'Q4'] as const) {
        if (!quarterlyThresholds[q].length) { e.quarterly = `Заполните правила для квартала ${q}`; break }
      }
    }
    if (formulaType === 'absolute_threshold') {
      if (!valueLabel.trim()) e.valueLabel = 'Укажите подпись поля ввода'
      if (isQuarterly) {
        for (const q of ['Q1', 'Q2', 'Q3', 'Q4'] as const) {
          if (!absoluteQThresholds[q].length) { e.absoluteRules = `Заполните правила для квартала ${q}`; break }
        }
      } else {
        if (!absoluteThresholds.length) e.absoluteRules = 'Добавьте хотя бы одно правило оценки'
        else if (!absoluteThresholds.some((r: ThresholdRule) => r.score === '0')) e.absoluteRules = 'Добавьте правило для минимального балла (0)'
        else if (absoluteThresholds.some((r: ThresholdRule) => !r.value || isNaN(parseFloat(r.value)))) e.absoluteRules = 'Введите числовые значения порогов'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload() {
    const base: any = {
      name: name.trim(),
      formula_type: formulaType,
      indicator_group: indicatorGroup,
      unit_name: unitName || null,
      is_common: isCommon,
      default_weight: isCommon ? defaultWeight : null,
      criterion: criterion.trim(),
      common_text_positive: positiveText.trim() || null,
      common_text_negative: negativeText.trim() || null,
    }
    if (formulaType === 'multi_binary') {
      base.sub_indicators = subBinaryItems.map((s: any, i: number) => ({
        description: s.description, order: i, sub_type: 'sub_binary',
        ...(s.sub_criterion?.trim() ? { sub_criterion: s.sub_criterion.trim() } : {}),
      }))
    }
    if (['binary_manual', 'multi_binary', 'threshold', 'quarterly_threshold', 'multi_threshold', 'absolute_threshold'].includes(formulaType)) {
      if (formulaDesc.trim()) base.formula_desc = formulaDesc.trim()
    }
    if (['threshold', 'quarterly_threshold'].includes(formulaType)) {
      base.numerator_label = numeratorLabel.trim()
      base.denominator_label = denominatorLabel.trim()
      base.cumulative = cumulative
    }
    if (formulaType === 'threshold') {
      base.thresholds = thresholds.map((r: ThresholdRule) => ({
        condition: `${r.operator}${r.value}`, score: parseFloat(r.score),
      }))
    }
    if (formulaType === 'quarterly_threshold') {
      base.quarterly_thresholds = Object.fromEntries(
        (['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => [
          q, quarterlyThresholds[q].map((r: ThresholdRule) => ({ condition: `${r.operator}${r.value}`, score: parseFloat(r.score) }))
        ])
      )
    }
    if (formulaType === 'multi_threshold') {
      base.sub_indicators = subThresholds.map((sub: any) => ({
        name: sub.name,
        numerator_label: sub.numerator_label,
        denominator_label: sub.denominator_label,
        cumulative: sub.cumulative,
        thresholds: sub.thresholds.map((r: ThresholdRule) => ({ condition: `${r.operator}${r.value}`, score: parseFloat(r.score) })),
      }))
    }
    if (formulaType === 'absolute_threshold') {
      base.value_label = valueLabel.trim()
      base.is_quarterly = isQuarterly
      base.cumulative = cumulative
      if (isQuarterly) {
        base.quarterly_thresholds = Object.fromEntries(
          (['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => [
            q, absoluteQThresholds[q].map((r: ThresholdRule) => ({ condition: `${r.operator}${r.value}`, score: parseFloat(r.score) }))
          ])
        )
      } else {
        base.thresholds = absoluteThresholds.map((r: ThresholdRule) => ({
          condition: `${r.operator}${r.value}`, score: parseFloat(r.score),
        }))
      }
    }
    return base
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      if (isEdit) {
        // For edit, only send updatable fields
        const updatePayload: any = {
          indicator_group: payload.indicator_group,
          unit_name: payload.unit_name,
          is_common: payload.is_common,
          criterion: payload.criterion,
          numerator_label: payload.numerator_label,
          denominator_label: payload.denominator_label,
          cumulative: payload.cumulative,
          thresholds: payload.thresholds,
          sub_indicators: payload.sub_indicators,
          quarterly_thresholds: payload.quarterly_thresholds,
          value_label: payload.value_label,
          is_quarterly: payload.is_quarterly,
          formula_desc: payload.formula_desc,
          common_text_positive: payload.common_text_positive,
          common_text_negative: payload.common_text_negative,
        }
        // TODO: АУДИТ 2026-05-04 — ограничения временно сняты
        updatePayload.name = payload.name
        updatePayload.formula_type = payload.formula_type
        await api.put(`/kpi/indicators/${initialData.id}`, updatePayload)
      } else {
        await api.post('/kpi/indicators', payload)
      }
      onSuccess()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  function copyActiveToAll() {
    const others = (['Q1', 'Q2', 'Q3', 'Q4'] as const).filter(q => q !== activeQuarter).join(', ')
    if (!confirm(`Скопировать правила ${activeQuarter} в ${others}? Текущие правила будут заменены.`)) return
    setQuarterlyThresholds(prev => {
      const src = prev[activeQuarter].map(r => ({ ...r }))
      return {
        Q1: activeQuarter === 'Q1' ? prev.Q1 : src,
        Q2: activeQuarter === 'Q2' ? prev.Q2 : src,
        Q3: activeQuarter === 'Q3' ? prev.Q3 : src,
        Q4: activeQuarter === 'Q4' ? prev.Q4 : src,
      }
    })
  }

  const title = isEdit ? 'РЕДАКТИРОВАТЬ ПОКАЗАТЕЛЬ' : 'НОВЫЙ ПОКАЗАТЕЛЬ'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', overflowY: 'auto', padding: '110px 24px 40px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="cyber-card"
        style={{ width: 700, maxWidth: '95vw', margin: '0 auto', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card)' }}>
          <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent3)' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Скроллящееся содержимое */}
        <div ref={formScrollRef} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* ТИП */}
          <div>
            <label style={LABEL_STYLE}>ТИП *</label>
            <select
              value={formulaType}
              onChange={e => {
                setFormulaType(e.target.value)
                setTimeout(() => formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50)
              }}
              // TODO: АУДИТ 2026-05-04 — смена типа разрешена для всех статусов, вернуть: disabled={isEdit}
              style={{ ...SELECT_STYLE }}
            >
              <option value="">— Выберите тип показателя —</option>
              {Object.entries(TYPE_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl} ({val})</option>
              ))}
            </select>
            {errors.formulaType && <div style={ERROR_STYLE}>{errors.formulaType}</div>}
            {formulaType && TYPE_DESCRIPTIONS[formulaType] && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,229,255,0.06)', borderRadius: 6, border: '1px solid rgba(0,229,255,0.15)', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>
                💡 {TYPE_DESCRIPTIONS[formulaType]}
              </div>
            )}
          </div>

          {/* НАЗВАНИЕ */}
          <div>
            <label style={LABEL_STYLE}>НАЗВАНИЕ *</label>
            {/* TODO: АУДИТ 2026-05-04 — disabled снят временно, вернуть после аудита */}
            <textarea
              rows={3}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Полное официальное название показателя из методики"
              style={{ ...INPUT_STYLE, resize: 'vertical' }}
            />
            {errors.name && <div style={ERROR_STYLE}>{errors.name}</div>}
          </div>

          {/* ГРУППА + Общий */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>ГРУППА *</label>
              <select
                value={indicatorGroup}
                onChange={e => setIndicatorGroup(e.target.value)}
                style={SELECT_STYLE}
              >
                <option value="">— Выберите группу —</option>
                {INDICATOR_GROUPS_LIST.filter(g => g.id !== 'all' && g.id !== 'Общие показатели').map(g => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
              {errors.indicatorGroup && <div style={ERROR_STYLE}>{errors.indicatorGroup}</div>}
            </div>
            <div style={{ paddingTop: 28 }}>
              <label
                title="Показатель автоматически добавляется всем 91 сотруднику. Только для HR/admin"
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}
              >
                <input type="checkbox" checked={isCommon} onChange={e => setIsCommon(e.target.checked)} />
                Общий для всех сотрудников
              </label>
            </div>
            {isCommon && (
              <div style={{ marginTop: 12 }}>
                <label style={LABEL_STYLE}>ВЕС ПО УМОЛЧАНИЮ (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={defaultWeight}
                  onChange={e => setDefaultWeight(parseInt(e.target.value) || 0)}
                  placeholder="10"
                  style={{ ...INPUT_STYLE, width: 100 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'Exo 2, sans-serif' }}>
                  Этот вес будет автоматически подставлен при добавлении показателя в карточку
                </div>
              </div>
            )}
          </div>

          {/* УПРАВЛЕНИЕ */}
          <div>
            <label style={LABEL_STYLE}>УПРАВЛЕНИЕ</label>
            <select value={unitName} onChange={e => setUnitName(e.target.value)} style={SELECT_STYLE}>
              <option value="">— Без привязки к управлению (общий) —</option>
              {UNIT_LIST.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'Exo 2, sans-serif' }}>
              Управление которому специфически принадлежит показатель
            </div>
          </div>

          {/* КРИТЕРИЙ */}
          <div>
            <label style={LABEL_STYLE}>КРИТЕРИЙ ОЦЕНКИ *</label>
            <textarea
              rows={4}
              value={criterion}
              onChange={e => setCriterion(e.target.value)}
              placeholder="Опишите что именно оценивается и по какому принципу"
              style={{ ...INPUT_STYLE, resize: 'vertical' }}
            />
            {errors.criterion && <div style={ERROR_STYLE}>{errors.criterion}</div>}
          </div>

          {/* ТЕКСТ ДЛЯ ОТЧЁТА — binary_manual и multi_binary */}
          {['binary_manual', 'multi_binary'].includes(formulaType) && (
            <div style={{ padding: '14px 16px', background: 'rgba(0,255,157,0.03)', border: '1px solid rgba(0,255,157,0.12)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', marginBottom: 12, letterSpacing: 1 }}>ТЕКСТ ДЛЯ ОТЧЁТА</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif', marginBottom: 12 }}>
                Эти тексты будут использованы при генерации PDF-отчёта. Необязательное поле.
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ ...LABEL_STYLE, color: 'var(--accent3)' }}>При выполнении ✅</label>
                <textarea
                  rows={2}
                  value={positiveText}
                  onChange={e => setPositiveText(e.target.value)}
                  placeholder="Показатель выполнен. Нарушений трудового распорядка не зафиксировано."
                  style={{ ...INPUT_STYLE, resize: 'vertical', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ ...LABEL_STYLE, color: 'var(--danger)' }}>При невыполнении ❌</label>
                <textarea
                  rows={2}
                  value={negativeText}
                  onChange={e => setNegativeText(e.target.value)}
                  placeholder="Показатель не выполнен. Зафиксировано нарушение трудового распорядка."
                  style={{ ...INPUT_STYLE, resize: 'vertical', fontSize: 12 }}
                />
              </div>
            </div>
          )}

          {/* МЕТОДИКА РАСЧЁТА */}
          {['binary_manual', 'multi_binary', 'threshold', 'multi_threshold', 'quarterly_threshold', 'absolute_threshold'].includes(formulaType) && (
            <div>
              <label style={LABEL_STYLE}>МЕТОДИКА РАСЧЁТА</label>
              <textarea
                rows={3}
                value={formulaDesc}
                onChange={e => setFormulaDesc(e.target.value)}
                placeholder="Опишите условие выполнения показателя в понятном виде. Например: «Отсутствие более 2-х повторных согласований ЛНА»"
                style={{ ...INPUT_STYLE, resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'Exo 2, sans-serif' }}>
                Необязательное поле. Отображается сотруднику при заполнении KPI-формы.
              </div>
            </div>
          )}

          {/* === MULTI_BINARY: Подпоказатели === */}
          {formulaType === 'multi_binary' && (
            <div>
              <label style={LABEL_STYLE}>ПОДПОКАЗАТЕЛИ * (минимум 2)</label>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, fontFamily: 'Exo 2, sans-serif' }}>
                Каждый подпоказатель руководитель оценит отдельно ✅/❌. Невыполнение хотя бы одного = 0 баллов.
              </div>
              {subBinaryItems.map((item: any, i: number) => (
                <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', fontSize: 11, minWidth: 20 }}>{i + 1}.</span>
                    <input
                      value={item.description}
                      onChange={e => {
                        const updated = subBinaryItems.map((s: any, idx: number) => idx === i ? { ...s, description: e.target.value } : s)
                        setSubBinaryItems(updated)
                      }}
                      placeholder="Описание (кратко)..."
                      style={{ ...INPUT_STYLE, flex: 1 }}
                    />
                    {subBinaryItems.length > 2 && (
                      <button
                        onClick={() => setSubBinaryItems(subBinaryItems.filter((_: any, idx: number) => idx !== i))}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}
                      >🗑</button>
                    )}
                  </div>
                  <div style={{ paddingLeft: 28 }}>
                    <textarea
                      rows={2}
                      value={item.sub_criterion || ''}
                      onChange={e => {
                        const updated = subBinaryItems.map((s: any, idx: number) => idx === i ? { ...s, sub_criterion: e.target.value } : s)
                        setSubBinaryItems(updated)
                      }}
                      placeholder="Критерий оценки (как проверять)..."
                      style={{ ...INPUT_STYLE, resize: 'vertical', fontSize: 12 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'Exo 2, sans-serif' }}>
                      Как именно руководитель проверяет этот подпоказатель
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setSubBinaryItems([...subBinaryItems, { description: '', order: subBinaryItems.length, sub_criterion: '' }])}
                style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: '4px 12px', fontFamily: 'Exo 2, sans-serif' }}
              >
                + Добавить подпоказатель
              </button>
              {errors.subBinary && <div style={ERROR_STYLE}>{errors.subBinary}</div>}
            </div>
          )}

          {/* === THRESHOLD: Числитель / Знаменатель / Пороги === */}
          {formulaType === 'threshold' && (
            <>
              <div style={{ padding: '12px 16px', background: 'rgba(0,255,157,0.04)', border: '1px solid rgba(0,255,157,0.15)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', marginBottom: 12 }}>ЧИСЛОВОЙ ПОКАЗАТЕЛЬ</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                  <div>
                    <label style={LABEL_STYLE}>ЧИСЛИТЕЛЬ *</label>
                    <input value={numeratorLabel} onChange={e => setNumeratorLabel(e.target.value)} placeholder="Что считаем (факт)" style={INPUT_STYLE} />
                    {errors.numerator && <div style={ERROR_STYLE}>{errors.numerator}</div>}
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>ЗНАМЕНАТЕЛЬ *</label>
                    <input value={denominatorLabel} onChange={e => setDenominatorLabel(e.target.value)} placeholder="База для расчёта % (план)" style={INPUT_STYLE} />
                    {errors.denominator && <div style={ERROR_STYLE}>{errors.denominator}</div>}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text)' }}>
                  <input type="checkbox" checked={cumulative} onChange={e => setCumulative(e.target.checked)} />
                  Нарастающим итогом
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>(данные суммируются с начала года)</span>
                </label>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(0,255,157,0.04)', border: '1px solid rgba(0,255,157,0.15)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace', marginBottom: 4 }}>ПРАВИЛА ОЦЕНКИ *</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, fontFamily: 'Exo 2, sans-serif' }}>
                  Условия проверяются сверху вниз. Первое совпавшее → балл. Обязательно добавьте правило с баллом 0.
                </div>
                <ThresholdRulesEditor rules={thresholds} onChange={setThresholds} />
                {errors.thresholds && <div style={ERROR_STYLE}>{errors.thresholds}</div>}
              </div>
            </>
          )}

          {/* === MULTI_THRESHOLD: Несколько числовых подпоказателей === */}
          {formulaType === 'multi_threshold' && (
            <div>
              <label style={LABEL_STYLE}>ПОДПОКАЗАТЕЛИ * (минимум 2)</label>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, fontFamily: 'Exo 2, sans-serif' }}>
                Каждый подпоказатель оценивается отдельно. Все должны быть выполнены (балл 100) — иначе итог 0.
              </div>
              {subThresholds.map((sub: any, i: number) => (
                <div key={i} style={{ padding: '12px 16px', background: 'rgba(180,160,255,0.06)', border: '1px solid rgba(180,160,255,0.2)', borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#b4a0ff', fontFamily: 'Orbitron, monospace' }}>ПОДПОКАЗАТЕЛЬ {i + 1}</div>
                    {subThresholds.length > 2 && (
                      <button onClick={() => setSubThresholds(subThresholds.filter((_: any, idx: number) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>🗑</button>
                    )}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={LABEL_STYLE}>НАЗВАНИЕ</label>
                    <input value={sub.name} onChange={e => { const u = subThresholds.map((s: any, idx: number) => idx === i ? { ...s, name: e.target.value } : s); setSubThresholds(u) }} placeholder="Название подпоказателя" style={INPUT_STYLE} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                    <div>
                      <label style={LABEL_STYLE}>ЧИСЛИТЕЛЬ *</label>
                      <input value={sub.numerator_label} onChange={e => { const u = subThresholds.map((s: any, idx: number) => idx === i ? { ...s, numerator_label: e.target.value } : s); setSubThresholds(u) }} style={INPUT_STYLE} />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>ЗНАМЕНАТЕЛЬ *</label>
                      <input value={sub.denominator_label} onChange={e => { const u = subThresholds.map((s: any, idx: number) => idx === i ? { ...s, denominator_label: e.target.value } : s); setSubThresholds(u) }} style={INPUT_STYLE} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                    <input type="checkbox" checked={sub.cumulative} onChange={e => { const u = subThresholds.map((s: any, idx: number) => idx === i ? { ...s, cumulative: e.target.checked } : s); setSubThresholds(u) }} />
                    Нарастающим итогом
                  </label>
                  <div style={{ fontSize: 11, color: '#b4a0ff', fontFamily: 'Orbitron, monospace', marginBottom: 6 }}>ПРАВИЛА ОЦЕНКИ</div>
                  <ThresholdRulesEditor
                    rules={sub.thresholds}
                    onChange={newRules => { const u = subThresholds.map((s: any, idx: number) => idx === i ? { ...s, thresholds: newRules } : s); setSubThresholds(u) }}
                  />
                </div>
              ))}
              <button
                onClick={() => setSubThresholds([...subThresholds, { name: '', numerator_label: '', denominator_label: '', cumulative: false, thresholds: [{ operator: '>=', value: '', score: '' }, { operator: '<', value: '', score: '0' }] }])}
                style={{ background: 'rgba(180,160,255,0.08)', border: '1px solid rgba(180,160,255,0.3)', borderRadius: 6, color: '#b4a0ff', cursor: 'pointer', fontSize: 12, padding: '4px 12px', fontFamily: 'Exo 2, sans-serif' }}
              >
                + Добавить подпоказатель
              </button>
              {errors.subThresholds && <div style={ERROR_STYLE}>{errors.subThresholds}</div>}
            </div>
          )}

          {/* === QUARTERLY_THRESHOLD: Квартальные пороги === */}
          {formulaType === 'quarterly_threshold' && (
            <>
              <div style={{ padding: '12px 16px', background: 'rgba(255,140,0,0.04)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#ff8c00', fontFamily: 'Orbitron, monospace', marginBottom: 12 }}>ЧИСЛОВОЙ ПОКАЗАТЕЛЬ</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                  <div>
                    <label style={LABEL_STYLE}>ЧИСЛИТЕЛЬ *</label>
                    <input value={numeratorLabel} onChange={e => setNumeratorLabel(e.target.value)} placeholder="Что считаем (факт)" style={INPUT_STYLE} />
                    {errors.numerator && <div style={ERROR_STYLE}>{errors.numerator}</div>}
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>ЗНАМЕНАТЕЛЬ *</label>
                    <input value={denominatorLabel} onChange={e => setDenominatorLabel(e.target.value)} placeholder="База для расчёта % (план)" style={INPUT_STYLE} />
                    {errors.denominator && <div style={ERROR_STYLE}>{errors.denominator}</div>}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--text)' }}>
                  <input type="checkbox" checked={cumulative} onChange={e => setCumulative(e.target.checked)} />
                  Нарастающим итогом
                </label>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(255,140,0,0.04)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#ff8c00', fontFamily: 'Orbitron, monospace', marginBottom: 4 }}>ПРАВИЛА ПО КВАРТАЛАМ *</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, fontFamily: 'Exo 2, sans-serif' }}>
                  Квартал определяется по дате окончания периода.
                </div>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                    <button key={q} onClick={() => setActiveQuarter(q)} style={{ padding: '6px 16px', borderRadius: '6px 6px 0 0', border: `1px solid ${activeQuarter === q ? '#ff8c00' : 'rgba(255,140,0,0.25)'}`, borderBottom: activeQuarter === q ? '1px solid var(--card)' : '1px solid rgba(255,140,0,0.25)', background: activeQuarter === q ? 'rgba(255,140,0,0.15)' : 'transparent', color: activeQuarter === q ? '#ff8c00' : 'var(--text-dim)', cursor: 'pointer', fontFamily: 'Orbitron, monospace', fontSize: 12 }}>
                      {q}
                    </button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <button onClick={copyActiveToAll} style={{ background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.3)', borderRadius: 6, color: '#ff8c00', cursor: 'pointer', fontSize: 11, padding: '4px 10px', fontFamily: 'Exo 2, sans-serif' }}>
                    Скопировать {activeQuarter} во все →
                  </button>
                </div>
                <ThresholdRulesEditor
                  rules={quarterlyThresholds[activeQuarter]}
                  onChange={newRules => setQuarterlyThresholds(prev => ({ ...prev, [activeQuarter]: newRules }))}
                />
                {errors.quarterly && <div style={ERROR_STYLE}>{errors.quarterly}</div>}
              </div>
            </>
          )}

          {/* ─── absolute_threshold ─── */}
          {formulaType === 'absolute_threshold' && (
            <>
              <div style={{ padding: '12px 16px', background: 'rgba(255,149,0,0.04)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#ff9500', fontFamily: 'Orbitron, monospace', marginBottom: 12 }}>ЧИСЛОВОЙ ПОКАЗАТЕЛЬ (АБСОЛЮТНЫЙ)</div>
                <label style={LABEL_STYLE}>ПОДПИСЬ ПОЛЯ ВВОДА *</label>
                <input
                  value={valueLabel}
                  onChange={e => setValueLabel(e.target.value)}
                  placeholder="Например: «Количество материалов», «Среднее число участников»"
                  style={INPUT_STYLE}
                />
                {errors.valueLabel && <div style={ERROR_STYLE}>{errors.valueLabel}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'Exo 2, sans-serif' }}>
                  Как называется вводимое сотрудником значение
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>
                    <input type="checkbox" checked={cumulative} onChange={e => setCumulative(e.target.checked)} />
                    Нарастающим итогом
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>
                    <input type="checkbox" checked={isQuarterly} onChange={e => setIsQuarterly(e.target.checked)} />
                    Квартальные пороги
                  </label>
                </div>
              </div>

              {!isQuarterly && (
                <div style={{ padding: '12px 16px', background: 'rgba(255,149,0,0.04)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#ff9500', fontFamily: 'Orbitron, monospace', marginBottom: 8 }}>ПРАВИЛА ОЦЕНКИ *</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, fontFamily: 'Exo 2, sans-serif' }}>
                    Сравнение идёт с абсолютным значением (не с процентом).
                  </div>
                  <ThresholdRulesEditor rules={absoluteThresholds} onChange={setAbsoluteThresholds} showPercent={false} />
                  {errors.absoluteRules && <div style={ERROR_STYLE}>{errors.absoluteRules}</div>}
                </div>
              )}

              {isQuarterly && (
                <div style={{ padding: '12px 16px', background: 'rgba(255,149,0,0.04)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#ff9500', fontFamily: 'Orbitron, monospace', marginBottom: 4 }}>ПРАВИЛА ПО КВАРТАЛАМ *</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                      <button key={q} onClick={() => setActiveQuarter(q)} style={{ padding: '6px 16px', borderRadius: '6px 6px 0 0', border: `1px solid ${activeQuarter === q ? '#ff9500' : 'rgba(255,149,0,0.25)'}`, borderBottom: activeQuarter === q ? '1px solid var(--card)' : '1px solid rgba(255,149,0,0.25)', background: activeQuarter === q ? 'rgba(255,149,0,0.15)' : 'transparent', color: activeQuarter === q ? '#ff9500' : 'var(--text-dim)', cursor: 'pointer', fontFamily: 'Orbitron, monospace', fontSize: 12 }}>
                        {q}
                      </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => {
                        const others = (['Q1','Q2','Q3','Q4'] as const).filter(q => q !== activeQuarter).join(', ')
                        if (!confirm(`Скопировать правила ${activeQuarter} в ${others}? Текущие правила будут заменены.`)) return
                        setAbsoluteQThresholds(prev => {
                          const src = prev[activeQuarter].map(r => ({ ...r }))
                          return { Q1: activeQuarter==='Q1'?prev.Q1:src, Q2: activeQuarter==='Q2'?prev.Q2:src, Q3: activeQuarter==='Q3'?prev.Q3:src, Q4: activeQuarter==='Q4'?prev.Q4:src }
                        })
                      }}
                      style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: 6, color: '#ff9500', cursor: 'pointer', fontSize: 11, padding: '4px 10px', fontFamily: 'Exo 2, sans-serif' }}
                    >
                      Скопировать {activeQuarter} во все →
                    </button>
                  </div>
                  <ThresholdRulesEditor
                    rules={absoluteQThresholds[activeQuarter]}
                    onChange={newRules => setAbsoluteQThresholds(prev => ({ ...prev, [activeQuarter]: newRules }))}
                    showPercent={false}
                  />
                  {errors.absoluteRules && <div style={ERROR_STYLE}>{errors.absoluteRules}</div>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Кнопки — фиксированный футер */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(0,229,255,0.2)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--card)' }}>
          <button className="action-btn btn-view" style={{ fontSize: 13 }} onClick={onClose}>Отмена</button>
          <button className="action-btn btn-fill" style={{ fontSize: 13 }} onClick={handleSubmit} disabled={saving}>
            {saving ? '...' : isEdit ? 'Сохранить' : '+ Создать показатель'}
          </button>
        </div>
      </div>
    </div>
  )
}

function KpiIndicatorsTab() {
  const [indicators, setIndicators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState('all')
  const [activeUnit, setActiveUnit] = useState('all')
  const [panelMode, setPanelMode] = useState<'groups'|'units'>('groups')
  const [search, setSearch] = useState('')
  const [editingIndicator, setEditingIndicator] = useState<any>(null)
  const [viewIndicatorId, setViewIndicatorId] = useState<string|null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  function fetchIndicators() {
    setLoading(true)
    api.get('/kpi/indicators?status=all')
      .then(r => setIndicators(Array.isArray(r.data) ? r.data : (r.data.items ?? [])))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchIndicators() }, [])

  // ESC закрывает модалки
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewIndicatorId(null)
        setEditingIndicator(null)
        setShowCreateModal(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  const groupCounts: Record<string, number> = { all: indicators.length }
  for (const g of INDICATOR_GROUPS_LIST.slice(1)) {
    groupCounts[g.id] = indicators.filter(ind => (ind.indicator_group || 'Прочие показатели') === g.id).length
  }

  // Уникальные управления из данных
  const unitCounts: Record<string, number> = { all: indicators.length }
  for (const u of UNIT_LIST) {
    unitCounts[u] = indicators.filter(ind => ind.unit_name === u).length
  }
  unitCounts['—'] = indicators.filter(ind => !ind.unit_name).length

  const filtered = indicators.filter(ind => {
    if (panelMode === 'groups') {
      if (activeGroup !== 'all' && (ind.indicator_group || 'Прочие показатели') !== activeGroup) return false
    } else {
      if (activeUnit !== 'all') {
        if (activeUnit === '—' && ind.unit_name) return false
        if (activeUnit !== '—' && ind.unit_name !== activeUnit) return false
      }
    }
    if (search && !ind.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openEdit(ind: any) {
    setEditingIndicator(ind)
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
      {/* Sticky шапка: поиск + кнопка */}
      <div style={{ position: 'sticky', top: 64, zIndex: 30, background: 'var(--bg)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
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
      </div>

      {/* Двухколоночный layout с внутренним скроллом */}
      <div style={{ display: 'flex', height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
        {/* Сайдбар групп / управлений */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Переключатель режимов */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {(['groups', 'units'] as const).map(mode => (
              <button key={mode} onClick={() => { setPanelMode(mode); setActiveGroup('all'); setActiveUnit('all') }}
                style={{ flex: 1, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: 'Orbitron, monospace', letterSpacing: 0.5,
                  color: panelMode === mode ? 'var(--accent)' : 'var(--text-dim)',
                  borderBottom: panelMode === mode ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {mode === 'groups' ? 'ПО ГРУППАМ' : 'ПО УПРАВЛ.'}
              </button>
            ))}
          </div>
          {/* Список */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
          {panelMode === 'groups' ? INDICATOR_GROUPS_LIST.map(g => (
            <div
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              style={{
                padding: '10px 16px', cursor: 'pointer',
                borderLeft: activeGroup === g.id ? '3px solid var(--accent)' : '3px solid transparent',
                background: activeGroup === g.id ? 'rgba(0,229,255,0.06)' : 'transparent',
                color: activeGroup === g.id ? 'var(--accent)' : 'rgba(232,234,246,0.65)',
                fontFamily: 'Exo 2, sans-serif', fontSize: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.15s', borderRadius: '0 6px 6px 0',
              }}
            >
              <span>{g.label}</span>
              <span style={{ background: activeGroup === g.id ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.06)', color: activeGroup === g.id ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontFamily: 'Orbitron, monospace' }}>
                {groupCounts[g.id] ?? 0}
              </span>
            </div>
          )) : [{ id: 'all', label: '📋 Все' }, ...UNIT_LIST.map(u => ({ id: u, label: `🏢 ${u}` })), { id: '—', label: '⬜ Без управления' }].map(u => (
            <div
              key={u.id}
              onClick={() => setActiveUnit(u.id)}
              style={{
                padding: '10px 16px', cursor: 'pointer',
                borderLeft: activeUnit === u.id ? '3px solid var(--accent)' : '3px solid transparent',
                background: activeUnit === u.id ? 'rgba(0,229,255,0.06)' : 'transparent',
                color: activeUnit === u.id ? 'var(--accent)' : 'rgba(232,234,246,0.65)',
                fontFamily: 'Exo 2, sans-serif', fontSize: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.15s', borderRadius: '0 6px 6px 0',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.label}</span>
              <span style={{ background: activeUnit === u.id ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.06)', color: activeUnit === u.id ? 'var(--accent)' : 'var(--text-dim)', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontFamily: 'Orbitron, monospace', flexShrink: 0, marginLeft: 4 }}>
                {unitCounts[u.id] ?? 0}
              </span>
            </div>
          ))}
          </div>
        </div>

        {/* Основная область */}
        <div style={{ flex: 1, paddingLeft: 20, overflowY: 'auto' }}>
          {/* Sticky заголовок колонок внутри скролл-контейнера */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: '#0a0a1a',
            borderBottom: '2px solid rgba(0,229,255,0.25)',
            display: 'grid',
            gridTemplateColumns: '1fr 160px 110px 230px',
            padding: '8px 16px',
          }}>
            <span style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'Orbitron, monospace' }}>НАЗВАНИЕ</span>
            <span style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'Orbitron, monospace' }}>ТИП</span>
            <span style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'Orbitron, monospace', textAlign: 'center' }}>ИСПОЛЬЗУЕТСЯ</span>
            <span></span>
          </div>

          {/* Список показателей */}
          <div className="cyber-card" style={{ padding: 0, borderRadius: '0 0 8px 8px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32, fontFamily: 'Exo 2, sans-serif', fontSize: 13 }}>
                Ничего не найдено
              </div>
            ) : filtered.map((ind: any) => {
              const isInactive = ind.status !== 'active'
              return (
                <div key={ind.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 160px 110px 230px',
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    transition: 'background 0.15s',
                    opacity: isInactive ? 0.5 : 1,
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontWeight: 600, fontFamily: 'Exo 2, sans-serif', fontSize: 13 }}>{ind.name}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {ind.is_common && <span style={{ fontSize: 10, color: 'var(--accent3)', fontFamily: 'Orbitron, monospace' }}>ОБЩИЙ</span>}
                      {ind.unit_name && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Exo 2, sans-serif' }}>🏢 {ind.unit_name}</span>}
                      {isInactive && <span style={{ fontSize: 10, color: '#888', fontFamily: 'Orbitron, monospace', background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '0 5px' }}>{ind.status}</span>}
                    </div>
                  </div>
                  <div>
                    <span style={{
                      background: `${TYPE_COLORS[ind.formula_type] || '#888'}22`,
                      color: TYPE_COLORS[ind.formula_type] || '#888',
                      border: `1px solid ${TYPE_COLORS[ind.formula_type] || '#888'}55`,
                      borderRadius: 6, padding: '2px 10px', fontSize: 11, fontFamily: 'Orbitron, monospace', whiteSpace: 'nowrap',
                    }}>
                      {TYPE_LABELS[ind.formula_type] || ind.formula_type}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', fontFamily: 'Orbitron, monospace', fontSize: 13, color: ind.used_in_cards_count > 0 ? 'var(--accent3)' : 'var(--text-dim)' }}>
                    {ind.used_in_cards_count ?? 0}
                  </div>
                  <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                    <button
                      className="action-btn btn-view"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => setViewIndicatorId(ind.id)}
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
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>

    {/* ── МОДАЛЬНОЕ ОКНО: ПРОСМОТР (viewOnly) ── */}
    {viewIndicatorId && (
      <IndicatorViewModal
        indicator={indicators.find(i => i.id === viewIndicatorId)}
        onClose={() => setViewIndicatorId(null)}
        onEdit={(ind) => { setViewIndicatorId(null); setEditingIndicator(ind) }}
      />
    )}

    {/* ── МОДАЛЬНОЕ ОКНО: РЕДАКТИРОВАНИЕ ── */}
    {editingIndicator && !editingIndicator._viewOnly && (
      <IndicatorFormModal
        initialData={editingIndicator}
        onClose={() => setEditingIndicator(null)}
        onSuccess={() => {
          // БАГ 2: закрываем форму, но если просмотр был открыт для того же показателя —
          // viewIndicatorId остаётся, и после fetchIndicators() покажет свежие данные
          const savedId = editingIndicator?.id
          fetchIndicators()
          setEditingIndicator(null)
          // Если редактирование открыто не из просмотра — оставить просмотр закрытым
          // Если открыто из просмотра (viewIndicatorId === savedId) — он останется открытым
          if (viewIndicatorId && viewIndicatorId !== savedId) setViewIndicatorId(null)
        }}
      />
    )}

    {/* ── МОДАЛЬНОЕ ОКНО: СОЗДАТЬ ПОКАЗАТЕЛЬ ── */}
    {showCreateModal && (
      <IndicatorFormModal
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => { fetchIndicators(); setShowCreateModal(false) }}
      />
    )}
    </>
  )
}
