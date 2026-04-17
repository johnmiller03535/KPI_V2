'use client'

import { useState, useEffect, useRef } from 'react'

type ThresholdRule = {
  conditions: string[]
  score: number
}

type KpiResult = {
  indicator: string
  criterion: string
  weight: number
  cumulative: boolean
  is_common: boolean
  score: number | null
  fact_value: number | null
  parsed_thresholds: ThresholdRule[] | null
}

type Props = {
  item: KpiResult
  disabled?: boolean
  onUpdate: (criterion: string, factValue: number) => Promise<void>
}

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-dim)'
  if (score >= 100) return 'var(--accent3)'
  if (score <= 0) return 'var(--danger)'
  return 'var(--warn)'
}

function ThresholdTable({ rules }: { rules: ThresholdRule[] }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--card-border)',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 14,
    }}>
      <div style={{
        padding: '6px 12px',
        fontSize: 10,
        fontFamily: 'Orbitron, sans-serif',
        letterSpacing: 1,
        color: 'var(--text-dim)',
        borderBottom: '1px solid var(--card-border)',
      }}>
        УСЛОВИЕ → ОЦЕНКА
      </div>
      {rules.map((rule, i) => {
        const color = rule.score >= 100
          ? 'var(--accent3)'
          : rule.score <= 0
            ? 'var(--danger)'
            : 'var(--warn)'
        return (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 12px',
            borderBottom: i < rules.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            backgroundColor: `${color}08`,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {rule.conditions.join(' И ')}
            </span>
            <span style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              color,
            }}>
              {rule.score}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function NumericInput({ item, disabled, onUpdate }: Props) {
  const [value, setValue] = useState<string>(
    item.fact_value !== null && item.fact_value !== undefined
      ? String(item.fact_value)
      : ''
  )
  const [localScore, setLocalScore] = useState<number | null>(item.score)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(
      item.fact_value !== null && item.fact_value !== undefined
        ? String(item.fact_value)
        : ''
    )
    setLocalScore(item.score)
  }, [item.fact_value, item.score])

  const handleChange = (raw: string) => {
    setValue(raw)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const num = parseFloat(raw)
    if (!isNaN(num) && !disabled) {
      debounceRef.current = setTimeout(async () => {
        setSaving(true)
        await onUpdate(item.criterion, num)
        setSaving(false)
      }, 800)
    }
  }

  const accent = localScore !== null
    ? (localScore >= 100 ? 'var(--accent3)' : localScore <= 0 ? 'var(--danger)' : 'var(--warn)')
    : 'var(--accent)'

  return (
    <div
      className="cyber-card"
      style={{ '--accent-color': accent } as React.CSSProperties}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
            {item.indicator}
            {item.cumulative && (
              <span style={{ marginLeft: 8, color: 'var(--accent2)' }}>↗ нарастающим итогом</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
            {item.criterion}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saving && (
            <span style={{ fontSize: 11, color: 'var(--accent)', opacity: 0.7 }}>сохранение...</span>
          )}
          {localScore !== null && (
            <span style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 20,
              fontWeight: 700,
              color: scoreColor(localScore),
            }}>
              {localScore}%
            </span>
          )}
        </div>
      </div>

      {item.parsed_thresholds && item.parsed_thresholds.length > 0 && (
        <ThresholdTable rules={item.parsed_thresholds} />
      )}

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
          Фактическое значение
        </div>
        <input
          type="number"
          className="cyber-input"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="Введите значение"
          disabled={disabled}
          step="0.01"
        />
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Вес: <strong style={{ color: 'var(--text)' }}>{item.weight}%</strong>
        </span>
        {item.is_common && <span className="badge badge-info" style={{ fontSize: 10 }}>Общий</span>}
      </div>
    </div>
  )
}
