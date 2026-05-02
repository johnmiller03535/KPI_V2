# ЗАДАЧА: Хотфикс таба «KPI-показатели»

> Файл для Claude Code | Дата: 2026-05-02 | Приоритет: 🔴

---

## БАГ 1 — Пропала строка заголовков таблицы

После добавления sticky-шапки исчезла строка `НАЗВАНИЕ / ТИП / ИСПОЛЬЗУЕТСЯ`.

### Причина
Строка заголовков таблицы, вероятно, была внутри sticky-блока или потеряна
при рефакторинге layout.

### Решение
Вернуть строку заголовков — она должна быть **внутри скроллящегося контейнера**,
прямо над списком показателей, и тоже быть sticky внутри него:

```tsx
{/* Скроллящаяся правая часть */}
<div style={{ flex: 1, overflowY: 'auto' }}>
  
  {/* Sticky заголовок таблицы ВНУТРИ скролл-контейнера */}
  <div style={{
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: 'var(--bg)',
    borderBottom: '2px solid var(--accent)',
    display: 'grid',
    gridTemplateColumns: '1fr 140px 100px 220px',
    padding: '8px 16px',
  }}>
    <span style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'Orbitron' }}>НАЗВАНИЕ</span>
    <span style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'Orbitron' }}>ТИП</span>
    <span style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'Orbitron' }}>ИСПОЛЬЗУЕТСЯ</span>
    <span></span>
  </div>

  {/* Список показателей */}
  {indicators.map(ind => (
    <div key={ind.id}> ... </div>
  ))}
</div>
```

---

## БАГ 2 — Счётчик 124 вместо 126

API возвращает 126 (проверено через `?status=all`), но счётчик в сайдбаре
считает по отфильтрованному массиву. Скорее всего фронтенд дополнительно
фильтрует `indicators.filter(i => i.is_active)` где-то при подсчёте.

### Решение
Найти место где вычисляется счётчик «Все» и убедиться что считаются
все записи из API без дополнительной фильтрации:

```typescript
// Счётчик для «Все» = total из API или indicators.length (без фильтров)
const totalCount = indicators.length  // все 126, включая неактивные
```

Неактивные показатели отображать с `opacity: 0.5` в списке — но в счётчик включать.

---

## ФАЙЛ

```
frontend/src/app/admin/page.tsx
```
