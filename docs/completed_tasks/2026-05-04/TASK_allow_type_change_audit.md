# ЗАДАЧА: Разрешить смену типа показателя в режиме аудита

> Файл для Claude Code | Дата: 2026-05-04 | Приоритет: 🔴
> ⚠️ ВРЕМЕННОЕ ИЗМЕНЕНИЕ — вернуть после завершения аудита

---

## Проблема

При редактировании показателя select «ТИП» недоступен для изменения
(заблокирован через `disabled` или проверку на фронтенде).

Мы проводим полный аудит показателей и нам нужно менять тип у существующих показателей.

## Что сделать

### Frontend (`frontend/src/app/admin/page.tsx`)

В `IndicatorFormModal` найти где select типа делается `disabled`:

```typescript
// Найти что-то вроде:
<select disabled={isEditing && indicator.status === 'active'} ...>

// СТАЛО — убрать disabled на время аудита:
<select ...>  // без disabled
```

Добавить TODO:
```typescript
// TODO: АУДИТ 2026-05-04 — смена типа разрешена для всех статусов
```

### Backend (`backend/app/api/admin.py` или `kpi_constructor.py`)

Проверить нет ли дополнительной блокировки смены `formula_type` на бэкенде.
Если есть — закомментировать с TODO-меткой.

## Файлы

```
frontend/src/app/admin/page.tsx
backend/app/api/admin.py (проверить)
backend/app/services/kpi_constructor.py (проверить)
```
