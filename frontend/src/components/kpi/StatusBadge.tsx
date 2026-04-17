type Props = {
  score: number | null
  requiresReview?: boolean
  awaitingManual?: boolean
  requiresFact?: boolean
}

export function StatusBadge({ score, requiresReview, awaitingManual, requiresFact }: Props) {
  if (awaitingManual) {
    return <span className="badge badge-dim">⏳ Ожидает руководителя</span>
  }
  if (requiresFact) {
    return <span className="badge badge-info">📝 Введите значение</span>
  }
  if (score === null || score === undefined) {
    return <span className="badge badge-warn">⏳ Ожидает</span>
  }
  if (score >= 100) {
    return (
      <span className="badge badge-success">
        ✅ Выполнено{requiresReview ? ' *' : ''}
      </span>
    )
  }
  if (score <= 0) {
    return <span className="badge badge-fail">❌ Не выполнено</span>
  }
  return <span className="badge badge-warn">⚠ Частично ({score}%)</span>
}
