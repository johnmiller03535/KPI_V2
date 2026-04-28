type ScoreData = {
  partial_score: number | null
  total_weight: number
  scored_weight: number
  completion_pct: number
}

type Props = {
  employeeName: string
  periodName: string
  status: string
  roleInfo: { role: string; unit: string } | null
  scoreData: ScoreData | null
  reviewerComment: string | null
  isEditable: boolean
  summaryLoading: boolean
  summaryLoaded: boolean
  submitting: boolean
  hasUnfilledNumeric: boolean
  onLoadSummary: () => void
  onSubmit: () => void
  onBack: () => void
}

const STATUS_LABEL: Record<string, string> = {
  draft:     'Черновик',
  submitted: 'На проверке',
  approved:  'Утверждён',
  rejected:  'Возвращён на доработку',
}

const STATUS_COLOR: Record<string, string> = {
  draft:     'var(--text-dim)',
  submitted: 'var(--warn)',
  approved:  'var(--accent3)',
  rejected:  'var(--danger)',
}

export function ScoreHeader({
  employeeName, periodName, status, roleInfo, scoreData,
  reviewerComment, isEditable, summaryLoading, summaryLoaded, submitting,
  hasUnfilledNumeric, onLoadSummary, onSubmit, onBack,
}: Props) {
  const score = scoreData?.partial_score
  const completion = scoreData?.completion_pct ?? 0
  const statusColor = STATUS_COLOR[status] || 'var(--text-dim)'

  return (
    <div style={{ marginBottom: 32, position: 'relative', zIndex: 1 }}>
      {/* Навигация */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontSize: 13,
          padding: 0,
          marginBottom: 20,
          fontFamily: 'Exo 2, sans-serif',
        }}
      >
        ← Дашборд
      </button>

      {/* Логотип + заголовок */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: 3,
          color: 'var(--accent)',
          marginBottom: 8,
          textShadow: 'var(--glow)',
        }}>
          KPI ПОРТАЛ
        </div>
        <h1 style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text)',
          lineHeight: 1.2,
        }}>
          {employeeName}
          <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>
            / {periodName}
          </span>
        </h1>
        {roleInfo && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            {roleInfo.role} · {roleInfo.unit}
          </div>
        )}
      </div>

      {/* Статус-бейдж */}
      <div style={{ marginBottom: 20 }}>
        <span className={`badge badge-${status === 'approved' ? 'success' : status === 'rejected' ? 'fail' : status === 'submitted' ? 'warn' : 'info'}`}>
          {STATUS_LABEL[status] || status}
        </span>
        {reviewerComment && (
          <div style={{
            marginTop: 10,
            padding: '10px 14px',
            background: 'rgba(255,184,0,0.06)',
            border: '1px solid rgba(255,184,0,0.2)',
            borderRadius: 10,
            fontSize: 13,
            color: 'var(--warn)',
          }}>
            <strong>Комментарий руководителя:</strong> {reviewerComment}
          </div>
        )}
      </div>

      {/* Score + прогресс */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--card-border)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Orbitron, sans-serif', letterSpacing: 2, marginBottom: 4 }}>
            ЧАСТИЧНЫЙ БАЛЛ
          </div>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1,
            color: score !== null ? 'var(--accent3)' : 'var(--text-dim)',
            textShadow: score !== null ? '0 0 20px rgba(0,255,157,0.4)' : 'none',
          }}>
            {score !== null ? `${score}%` : '—'}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--text-dim)',
            marginBottom: 6,
          }}>
            <span>Заполнено</span>
            <span style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--accent)' }}>
              {completion.toFixed(0)}%
            </span>
          </div>
          <div className="progress-bar-wrap">
            <div
              className="progress-bar-fill"
              style={{
                width: `${completion}%`,
                background: completion >= 100 ? 'var(--accent3)' : 'var(--accent)',
                color: completion >= 100 ? 'var(--accent3)' : 'var(--accent)',
              }}
            />
          </div>
          {scoreData && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>
              {scoreData.scored_weight} / {scoreData.total_weight} пунктов оценено
            </div>
          )}
        </div>
      </div>

      {/* Кнопки действий */}
      {isEditable && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="cyber-btn cyber-btn-ai"
            onClick={onLoadSummary}
            disabled={summaryLoading || submitting}
          >
            {summaryLoading ? '⏳ Загрузка...' : summaryLoaded ? '🔄 Обновить саммари' : '📥 Загрузить саммари из Redmine'}
          </button>
          <button
            className="cyber-btn cyber-btn-success"
            onClick={onSubmit}
            disabled={submitting || summaryLoading || !summaryLoaded || hasUnfilledNumeric}
            title={!summaryLoaded ? 'Сначала загрузите саммари' : hasUnfilledNumeric ? 'Заполните числовые показатели' : ''}
          >
            {submitting ? '⏳ AI анализирует...' : '📤 Отправить на проверку'}
          </button>
          {!summaryLoaded && !summaryLoading && (
            <span style={{ fontSize: 12, color: 'var(--accent)', alignSelf: 'center' }}>
              ← Загрузите саммари перед отправкой
            </span>
          )}
          {summaryLoaded && hasUnfilledNumeric && (
            <span style={{ fontSize: 12, color: 'var(--warn)', alignSelf: 'center' }}>
              ⚠ Заполните числовые показатели
            </span>
          )}
        </div>
      )}

      {status === 'approved' && (
        <div style={{ marginTop: 10 }}>
          <a
            href={`/api/reports/${window?.location?.pathname?.split('/')?.[2]}/pdf`}
            style={{ textDecoration: 'none' }}
          >
            <button className="cyber-btn cyber-btn-primary">📄 Скачать PDF-отчёт</button>
          </a>
        </div>
      )}
    </div>
  )
}
