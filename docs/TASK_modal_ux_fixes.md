# ЗАДАЧА: Три UX-фикса модалок показателей

> Файл для Claude Code | Дата: 2026-05-04 | Приоритет: 🔴

---

## БАГ 1 — Шапка формы редактирования перекрывается навбаром

### Проблема
При открытии формы редактирования/создания верхняя часть (заголовок + поле «ТИП»)
скрыта за навбаром.

### Решение
Overlay модалки должен учитывать высоту навбара:
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  padding-top: 64px;   /* высота навбара */
  display: flex;
  align-items: flex-start;  /* прижать к верху с отступом */
  justify-content: center;
  z-index: 100;
  background: rgba(0,0,0,0.75);
  overflow-y: auto;
}

.modal-content {
  margin-top: 16px;
  margin-bottom: 16px;
  /* убрать align-items: center — оно конфликтует с padding-top */
}
```

---

## БАГ 2 — Модалка «Просмотр» показывает старые данные после сохранения

### Проблема
После редактирования и сохранения показателя кнопка «Просмотр» открывает модалку
со старыми данными — данные не обновляются из API после save.

### Причина
Скорее всего `viewIndicator` state хранит старый объект из списка.
После `fetchIndicators()` список обновляется, но `viewIndicator` не переинициализируется.

### Решение
После сохранения — обновить `viewIndicator` если он открыт:
```typescript
// После успешного PATCH:
await fetchIndicators()

// Если просмотр открыт для того же показателя — обновить
if (viewIndicator?.id === updatedId) {
  const updated = indicators.find(i => i.id === updatedId)
  if (updated) setViewIndicator(updated)
}
```

Или проще — при открытии «Просмотр» всегда брать свежие данные из обновлённого массива `indicators`,
а не из кэшированного объекта.

---

## БАГ 3 — В просмотре пороги показывают «%» вместо реальных значений, и старый numerator_label

### Проблема (видно на скриншоте)
В модалке просмотра:
- Пороги: `% → 100 баллов` / `% → 0 баллов` — значения не отображаются
- Показывается «Числитель: Отсутствие более 2-х...» — это старый `numerator_label`,
  для `absolute_threshold` нужно показывать `value_label`, не `numerator_label`

### Решение — пороги
В компоненте просмотра найти рендер порогов.
Пороги хранятся в `criteria.thresholds` как JSON массив объектов:
```json
[{"operator": "<=", "value": 2, "score": 100}, {"operator": ">", "value": 2, "score": 0}]
```

Отображать как:
```typescript
// Для threshold/multi_threshold/quarterly_threshold:
`${rule.operator}${rule.value}% → ${rule.score} баллов`

// Для absolute_threshold — без %:
`${rule.operator}${rule.value} → ${rule.score} баллов`
```

### Решение — числитель/знаменатель vs value_label
В модалке просмотра:
```typescript
if (indicator.formula_type === 'absolute_threshold') {
  // Показывать: «Поле ввода: {value_label}»
  // НЕ показывать: «Числитель / Знаменатель»
} else if (['threshold', 'multi_threshold', 'quarterly_threshold'].includes(formula_type)) {
  // Показывать: «Числитель: {numerator_label}» и «Знаменатель: {denominator_label}»
}
```

---

## БАГ 4 (бонус) — ESC закрывает модалку

Добавить обработчик клавиши ESC для закрытия обеих модалок (просмотр и редактирование):

```typescript
useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setViewIndicator(null)
      setEditIndicator(null)
    }
  }
  window.addEventListener('keydown', handleEsc)
  return () => window.removeEventListener('keydown', handleEsc)
}, [])
```

---

## ФАЙЛ

```
frontend/src/app/admin/page.tsx
```
