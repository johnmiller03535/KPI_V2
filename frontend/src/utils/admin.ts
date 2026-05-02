/**
 * Нормализует название подразделения: берёт только верхний уровень (до первой точки),
 * схлопывает множественные пробелы. Используется в табах «Подчинённость» и «KPI-карточки».
 */
export function normalizeUnit(unit: string): string {
  return unit
    .split('.')[0]
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Строит Map<верхний_уровень, количество> из массива объектов с полем `unit`.
 * «Руководство» сортируется первым, остальные — по localeCompare('ru').
 */
export function buildDeptMap(items: { unit?: string | null }[]): Map<string, number> {
  const map = new Map<string, number>()
  items.forEach(item => {
    const u = normalizeUnit(item.unit || 'Прочие') || 'Прочие'
    map.set(u, (map.get(u) ?? 0) + 1)
  })
  return map
}

export function sortedDeptKeys(map: Map<string, number>): string[] {
  return [...map.keys()].sort((a, b) => {
    if (a === 'Руководство') return -1
    if (b === 'Руководство') return 1
    return a.localeCompare(b, 'ru')
  })
}
