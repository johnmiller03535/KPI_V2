/**
 * Возвращает эффективный score KPI-показателя:
 * для binary_auto manager_override имеет приоритет над AI-оценкой.
 */
export function effectiveKpiScore(k: {
  formula_type?: string
  score?: number | null
  manager_override?: boolean | null
}): number | null {
  if (
    k.formula_type === 'binary_auto' &&
    k.manager_override !== null &&
    k.manager_override !== undefined
  ) {
    return k.manager_override ? 100 : 0
  }
  return k.score ?? null
}

/**
 * Взвешенное среднее score по всем оценённым KPI.
 * manager_override учитывается для binary_auto.
 */
export function computeScore(kpiValues: any[] | null): number | null {
  if (!kpiValues || kpiValues.length === 0) return null
  const scored = kpiValues.filter(k => effectiveKpiScore(k) !== null)
  if (scored.length === 0) return null
  const sw = scored.reduce((s: number, k: any) => s + k.weight, 0)
  if (sw === 0) return null
  return Math.round(
    scored.reduce((s: number, k: any) => s + (effectiveKpiScore(k) as number) * k.weight, 0) / sw
  )
}
