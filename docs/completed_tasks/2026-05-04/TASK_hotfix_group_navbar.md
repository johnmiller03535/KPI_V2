# ЗАДАЧА: Точечный хотфикс — группа + перекрытие навбаром

> Файл для Claude Code | Дата: 2026-05-03 | Приоритет: 🔴

---

## БАГ 1 — Группа не сохраняется (воспроизводится стабильно)

### Диагностика через консоль браузера

Перед нажатием «+ Создать показатель» добавить `console.log` прямо в `handleSubmit`:

```typescript
console.log('SUBMIT group_name:', formData.group_name)
console.log('SUBMIT full body:', JSON.stringify(body))
```

Также в Network → найти POST `/api/admin/indicators/` → Request Payload →
скопировать сюда что отправляется.

### Вероятный корень

`IndicatorFormModal` получает `initialData` при редактировании и `undefined` при создании.
Скорее всего `group_name` инициализируется из `initialData?.group_name ?? ''`
но при создании форма сбрасывает state при каждом рендере.

**Проверить:** есть ли `useEffect` или инициализация state которая сбрасывает
`group_name` в `''` при открытии модалки создания?

### Конкретное исправление

В `IndicatorFormModal` найти инициализацию state формы и убедиться:

```typescript
const [formData, setFormData] = useState({
  name: initialData?.name ?? '',
  group_name: initialData?.group_name ?? '',  // ← при создании = ''
  formula_type: initialData?.formula_type ?? '',
  criterion: initialData?.criterion ?? '',
  is_common: initialData?.is_common ?? false,
  // ...остальные поля
})

// onChange дропдауна группы — убедиться что key совпадает:
onChange={(e) => setFormData(prev => ({ ...prev, group_name: e.target.value }))}
//                                                ^^^^^^^^^^

// handleSubmit — убедиться что читается тот же key:
const body = {
  group_name: formData.group_name,  // ← не group, не groupName
  // ...
}
```

Если `group_name` нигде не теряется — проверить бэкенд:
`POST /api/admin/indicators/` в `admin.py` — поле `group_name` присутствует в схеме
и сохраняется в `kpi_indicators.group_name`.

---

## БАГ 2 — Верхняя часть модалки скрыта за навбаром

### Проблема
Заголовок «НОВЫЙ ПОКАЗАТЕЛЬ» и поле «ТИП» обрезаются сверху навбаром.

### Исправление
Overlay должен начинаться ПОД навбаром или модалка должна иметь `margin-top`:

**Вариант А — padding-top на overlay (проще):**
```tsx
<div style={{
  position: 'fixed',
  inset: 0,
  paddingTop: '64px',   // высота навбара
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  background: 'rgba(0,0,0,0.75)',
}}>
```

**Вариант Б — margin-top на модалке:**
```tsx
<div className="modal-content" style={{
  marginTop: '64px',   // отступ от навбара
  maxHeight: 'calc(88vh - 64px)',
}}>
```

Выбрать тот вариант который не ломает центрирование модалки по вертикали.

---

## Файл

```
frontend/src/app/admin/page.tsx
```
