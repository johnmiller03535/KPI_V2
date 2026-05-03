# ЗАДАЧА: Мелкие UX-правки конструктора показателей

> Файл для Claude Code | Дата: 2026-05-03 | Приоритет: 🟡

---

## ПРАВКА 1 — quarterly_threshold: кнопка копирует текущий квартал, не Q1

### Проблема
Кнопка «Скопировать Q1 во все →» всегда копирует Q1 независимо от активного таба.
Пользователь заполнил Q2, нажал кнопку — ожидал скопировать Q2 в Q3 и Q4,
но получил копирование Q1 (потерял правки Q2).

### Решение
Кнопка должна копировать **активный квартал** во все остальные.
Текст кнопки меняется в зависимости от активного таба:

```typescript
// Текст кнопки:
`Скопировать ${activeQuarter} во все →`
// Например: «Скопировать Q2 во все →»

// Логика при клике:
const sourceRules = quarterRules[activeQuarter]  // берём из активного таба
setQuarterRules({
  Q1: activeQuarter === 'Q1' ? sourceRules : [...sourceRules],
  Q2: activeQuarter === 'Q2' ? sourceRules : [...sourceRules],
  Q3: activeQuarter === 'Q3' ? sourceRules : [...sourceRules],
  Q4: activeQuarter === 'Q4' ? sourceRules : [...sourceRules],
})
```

Добавить confirm-диалог: «Скопировать правила Q2 в Q1, Q3, Q4? Текущие правила будут заменены.»
чтобы пользователь не потерял данные случайно.

---

## ПРАВКА 2 — Скролл к началу формы при смене типа

### Проблема
При выборе типа в дропдауне форма перерисовывается (появляются новые поля),
но шапка формы (заголовок «НОВЫЙ ПОКАЗАТЕЛЬ» + поле «ТИП») скрывается за навбаром.
Пользователь видит середину формы вместо начала.

### Решение
При onChange дропдауна типа — скроллить контейнер формы к началу:

```typescript
const formScrollRef = useRef<HTMLDivElement>(null)

const handleTypeChange = (newType: string) => {
  setFormData(prev => ({ ...prev, formula_type: newType }))
  // Скролл к началу скроллящегося контейнера формы
  setTimeout(() => {
    formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, 50)
}

// На скроллящемся div формы:
<div ref={formScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
  {/* поля формы */}
</div>
```

---

## ФАЙЛ

```
frontend/src/app/admin/page.tsx
```
