'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type Period = {
  id: string
  name: string
  period_type: string
  status: string
}

type DeptReadiness = {
  department_code: string
  department_name: string
  total_employees: number
  approved_count: number
  pending_count: number
  is_complete: boolean
  completion_pct: number
}

type PeriodSummary = {
  period_name: string
  total_approved: number
  total_employees: number
  completion_pct: number
  dept_readiness: DeptReadiness[]
}

type Report = {
  submission_id: string
  employee_full_name: string
  employee_login: string
  department_code: string
  department_name: string
  role_name: string | null
  period_name: string
  redmine_issue_id: number | null
  redmine_issue_url: string | null
  approved_at: string | null
  reviewer_login: string | null
  pdf_available: boolean
}

const DEPT_CODES = [
  { code: '', label: 'Все подразделения' },
  { code: 'kpi-ruk', label: 'Руководство' },
  { code: 'kpi-org', label: 'УП организационного обеспечения' },
  { code: 'kpi-pra', label: 'Правовое управление' },
  { code: 'kpi-kza', label: 'УП корпоративных закупок' },
  { code: 'kpi-zpd', label: 'УП подготовки ЗИТ' },
  { code: 'kpi-zpr', label: 'УП проведения ЗИТ' },
  { code: 'kpi-tsr', label: 'УП цифровой трансформации' },
  { code: 'kpi-feo', label: 'УП методологии ЕАСУЗ' },
  { code: 'kpi-iaa', label: 'УП анализа и автоматизации' },
]

export default function FinancePage() {
  const router = useRouter()
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'summary' | 'list'>('summary')

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (!user) { router.push('/login'); return }
    const u = JSON.parse(user)
    if (!['admin', 'finance'].includes(u.role)) {
      router.push('/dashboard'); return
    }
    loadPeriods()
  }, [])

  useEffect(() => {
    if (selectedPeriod) {
      loadData()
    }
  }, [selectedPeriod, selectedDept])

  async function loadPeriods() {
    try {
      const res = await api.get('/finance/periods')
      setPeriods(res.data)
      if (res.data.length > 0) {
        setSelectedPeriod(res.data[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function loadData() {
    try {
      const params = new URLSearchParams()
      params.set('period_id', selectedPeriod)
      if (selectedDept) params.set('department_code', selectedDept)

      const [summaryRes, reportsRes] = await Promise.all([
        api.get(`/finance/periods/${selectedPeriod}/summary`),
        api.get(`/finance/reports?${params.toString()}`),
      ])
      setSummary(summaryRes.data)
      setReports(reportsRes.data)
    } catch (e) {
      console.error(e)
    }
  }

  const s: Record<string, any> = {
    page: { padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' },
    card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' },
    select: { padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.875rem', background: 'white' },
    tab: (active: boolean) => ({
      padding: '0.5rem 1.25rem',
      background: active ? '#2563eb' : '#f1f5f9',
      color: active ? 'white' : '#64748b',
      border: 'none', borderRadius: '6px',
      cursor: 'pointer', fontSize: '0.875rem',
      fontWeight: active ? 600 : 400,
    }),
    badge: (complete: boolean) => ({
      display: 'inline-block', padding: '0.2rem 0.6rem',
      background: complete ? '#dcfce7' : '#fef9c3',
      color: complete ? '#166534' : '#854d0e',
      borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
    }),
  }

  if (loading) return <div style={s.page}><p>Загрузка...</p></div>

  if (periods.length === 0) return (
    <div style={s.page}>
      <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Дашборд</a>
      <h1 style={{ marginTop: '0.5rem' }}>Финансовый дашборд</h1>
      <div style={{ ...s.card, textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
        Нет активных или закрытых периодов
      </div>
    </div>
  )

  // Группировка отчётов по подразделению
  const reportsByDept: Record<string, Report[]> = {}
  for (const r of reports) {
    const key = r.department_name || 'Без подразделения'
    if (!reportsByDept[key]) reportsByDept[key] = []
    reportsByDept[key].push(r)
  }

  return (
    <div style={s.page}>
      {/* Заголовок */}
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Дашборд</a>
        <h1 style={{ margin: '0.5rem 0 0.25rem' }}>Финансовый дашборд</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>
          Утверждённые KPI-отчёты для расчёта премирования
        </p>
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Период</label>
          <select style={s.select} value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Подразделение</label>
          <select style={s.select} value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}>
            {DEPT_CODES.map(d => (
              <option key={d.code} value={d.code}>{d.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={s.tab(view === 'summary')} onClick={() => setView('summary')}>
            📊 Сводка
          </button>
          <button style={s.tab(view === 'list')} onClick={() => setView('list')}>
            📋 Список
          </button>
        </div>
      </div>

      {/* Сводка по периоду */}
      {view === 'summary' && summary && (
        <>
          {/* Общий прогресс */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{summary.period_name}</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                  Утверждено {summary.total_approved} из {summary.total_employees} отчётов
                </p>
              </div>
              <div style={{
                fontSize: '2rem', fontWeight: 700,
                color: summary.completion_pct >= 80 ? '#22c55e' :
                       summary.completion_pct >= 50 ? '#f59e0b' : '#ef4444',
              }}>
                {summary.completion_pct}%
              </div>
            </div>
            <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${summary.completion_pct}%`,
                background: summary.completion_pct >= 80 ? '#22c55e' :
                            summary.completion_pct >= 50 ? '#f59e0b' : '#ef4444',
                borderRadius: '6px', transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {/* По подразделениям */}
          <div style={s.card}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Готовность по подразделениям</h2>
            {summary.dept_readiness.map(dept => (
              <div key={dept.department_code} style={{ padding: '0.875rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{dept.department_name}</span>
                    <span style={{ ...s.badge(dept.is_complete), marginLeft: '0.75rem' }}>
                      {dept.is_complete ? '✅ Готово' : '⏳ Частично'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {dept.approved_count} / {dept.total_employees}
                    <span style={{
                      marginLeft: '0.5rem', fontWeight: 600,
                      color: dept.completion_pct === 100 ? '#22c55e' : '#f59e0b',
                    }}>
                      ({dept.completion_pct}%)
                    </span>
                  </span>
                </div>
                <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${dept.completion_pct}%`,
                    background: dept.is_complete ? '#22c55e' : '#f59e0b',
                    borderRadius: '3px',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Список отчётов */}
      {view === 'list' && (
        <div>
          {Object.keys(reportsByDept).length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center' as const, color: '#64748b', padding: '3rem' }}>
              Утверждённых отчётов не найдено
            </div>
          ) : (
            Object.entries(reportsByDept).map(([deptName, deptReports]) => (
              <div key={deptName} style={s.card}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1e293b' }}>
                  {deptName}
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>
                    ({deptReports.filter(r => r.redmine_issue_id).length} / {deptReports.length} с PDF)
                  </span>
                </h3>
                {deptReports.map(report => (
                  <div key={report.submission_id} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '0.625rem 0',
                    borderBottom: '1px solid #f8fafc', fontSize: '0.875rem',
                  }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontWeight: 500 }}>{report.employee_full_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {report.role_name || report.employee_login}
                      </div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' as const, fontSize: '0.8rem', color: '#64748b' }}>
                      {report.approved_at
                        ? new Date(report.approved_at).toLocaleDateString('ru-RU')
                        : '—'}
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' as const }}>
                      {report.reviewer_login && (
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          ✅ {report.reviewer_login}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      {report.redmine_issue_url && (
                        <a
                          href={report.redmine_issue_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '0.3rem 0.75rem',
                            background: '#f1f5f9', color: '#334155',
                            border: '1px solid #e2e8f0', borderRadius: '4px',
                            textDecoration: 'none', fontSize: '0.8rem',
                          }}
                        >
                          🔗 Redmine
                        </a>
                      )}
                      {report.pdf_available && (
                        <a
                          href={`/api/reports/${report.submission_id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '0.3rem 0.75rem',
                            background: '#7c3aed', color: 'white',
                            border: 'none', borderRadius: '4px',
                            textDecoration: 'none', fontSize: '0.8rem',
                          }}
                        >
                          📄 PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
