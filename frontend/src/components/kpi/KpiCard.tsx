import { StatusBadge } from './StatusBadge'

type KpiResult = {
  indicator: string
  criterion: string
  formula_type: string
  weight: number
  is_common: boolean
  cumulative: boolean
  kpi_type: string
  score: number | null
  confidence: number | null
  summary: string | null
  awaiting_manual_input: boolean
  requires_fact_input: boolean
  requires_review: boolean
  parsed_thresholds: Array<{ conditions: string[]; score: number }> | null
  fact_value: number | null
}

type Props = {
  item: KpiResult
  accentColor?: string
}

function accentFromScore(score: number | null, requiresFact?: boolean, awaitingManual?: boolean): string {
  if (awaitingManual) return 'rgba(232,234,246,0.3)'
  if (requiresFact) return 'var(--accent)'
  if (score === null) return 'var(--warn)'
  if (score >= 100) return 'var(--accent3)'
  if (score <= 0) return 'var(--danger)'
  return 'var(--warn)'
}

export function KpiCard({ item }: Props) {
  const accent = accentFromScore(
    item.score,
    item.requires_fact_input,
    item.awaiting_manual_input
  )

  return (
    <div
      className="cyber-card"
      style={{ '--accent-color': accent } as React.CSSProperties}
    >
      {/* Заголовок карточки */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            {item.indicator}
            {item.cumulative && (
              <span style={{ marginLeft: 8, color: 'var(--accent2)' }}>↗ нарастающим итогом</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'var(--text)' }}>
            {item.criterion}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <StatusBadge
            score={item.score}
            requiresReview={item.requires_review}
            awaitingManual={item.awaiting_manual_input}
            requiresFact={item.requires_fact_input}
          />
        </div>
      </div>

      {/* AI summary */}
      {item.summary && (
        <>
          <hr className="cyber-divider" />
          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.6 }}>
            {item.summary}
          </div>
        </>
      )}

      {/* Уверенность AI */}
      {item.confidence !== null && item.confidence !== undefined && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 5,
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Уверенность AI</span>
            <span style={{
              fontSize: 12,
              fontFamily: 'Orbitron, sans-serif',
              color: item.confidence >= 80 ? 'var(--accent3)' : 'var(--warn)',
            }}>
              {item.confidence}%
            </span>
          </div>
          <div className="progress-bar-wrap">
            <div
              className="progress-bar-fill"
              style={{
                width: `${item.confidence}%`,
                background: item.confidence >= 80 ? 'var(--accent3)' : 'var(--warn)',
                color: item.confidence >= 80 ? 'var(--accent3)' : 'var(--warn)',
              }}
            />
          </div>
          {item.requires_review && (
            <div style={{ marginTop: 6 }}>
              <span className="badge badge-warn">⚠ Требует проверки</span>
            </div>
          )}
        </div>
      )}

      {/* Метаданные */}
      <div style={{
        marginTop: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Вес: <strong style={{ color: 'var(--text)' }}>{item.weight}%</strong>
        </span>
        {item.is_common && (
          <span className="badge badge-info" style={{ fontSize: 10 }}>Общий</span>
        )}
      </div>
    </div>
  )
}
