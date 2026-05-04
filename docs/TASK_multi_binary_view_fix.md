# ЗАДАЧА: Два фикса — просмотр multi_binary + обновление данных после сохранения

> Файл для Claude Code | Дата: 2026-05-04 | Приоритет: 🔴

---

## БАГ 1 — Просмотр multi_binary показывает пороги вместо подпоказателей

### Проблема
В модалке просмотра для `multi_binary` отображается секция «ПРАВИЛА ОЦЕНКИ»
с пустыми `% → 100 баллов` / `% → 0 баллов`.

Для `multi_binary` нет порогов — есть список подпоказателей из `kpi_criteria`
с `sub_type = 'sub_binary'`.

### Решение

В модалке просмотра добавить условную логику:

```typescript
// Для binary_auto, binary_manual — ничего не показывать (нет порогов, нет подпоказателей)

// Для multi_binary — показывать ПОДПОКАЗАТЕЛИ:
{indicator.formula_type === 'multi_binary' && criteria?.filter(c => c.sub_type === 'sub_binary').length > 0 && (
  <div className="view-section">
    <div className="section-label">ПОДПОКАЗАТЕЛИ</div>
    <div className="section-hint">Руководитель оценивает каждый отдельно. Все должны быть ✅</div>
    {criteria.filter(c => c.sub_type === 'sub_binary').map((sub, i) => (
      <div key={sub.id} className="sub-indicator-row">
        <span className="sub-num">{i + 1}.</span>
        <span>{sub.description}</span>
      </div>
    ))}
  </div>
)}

// Для threshold, multi_threshold, quarterly_threshold, absolute_threshold — показывать ПРАВИЛА ОЦЕНКИ
{['threshold', 'multi_threshold', 'quarterly_threshold', 'absolute_threshold']
  .includes(indicator.formula_type) && (
  <div className="view-section">
    <div className="section-label">ПРАВИЛА ОЦЕНКИ</div>
    {/* существующий рендер правил */}
  </div>
)}
```

### API
Убедиться что эндпоинт `GET /api/admin/indicators/{id}` (или список)
возвращает `criteria` включая записи с `sub_type = 'sub_binary'`.
Если нет — добавить их в ответ.

---

## БАГ 2 — После сохранения данные в просмотре не обновляются

### Проблема
После нажатия «Сохранить» в форме редактирования — модалка просмотра
(если открыта) показывает старые данные.

### Причина
Предыдущий фикс хранит `viewIndicatorId` и берёт данные из `indicators[]`.
Но `indicators[]` не перезагружается после save, ИЛИ `viewIndicatorId`
сбрасывается раньше чем данные обновятся.

### Решение
```typescript
const handleSave = async () => {
  // ... сохранение ...
  await fetchIndicators()  // ← обновить массив
  // Если просмотр был открыт для этого же показателя — не закрывать его
  // viewIndicatorId остаётся тем же, indicators[] уже обновлён → данные свежие
  setEditIndicatorId(null)  // закрыть только форму редактирования
  // setViewIndicatorId(null) — НЕ закрывать просмотр
}
```

Или если просмотр не открыт — просто закрыть форму после сохранения.

---

## ФАЙЛЫ

```
frontend/src/app/admin/page.tsx
backend/app/api/admin.py  (если нужно добавить sub_binary в ответ)
```
