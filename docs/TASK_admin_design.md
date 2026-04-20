# Задача: Dark Cyber дизайн для всей admin-панели
> Для Claude Code | Эталон: /review/page.tsx и /dashboard/page.tsx

## Контекст
Все страницы портала (/dashboard, /review, /kpi/[id]) уже в Dark Cyber стиле.
Admin-панель (/admin) пока выглядит иначе — нужно привести к единому стилю.
Логику и данные не трогать — только стили.

---

## Эталон дизайна (из cyber.css)

```
Фон страницы:   #06060f
Акцент:         #00e5ff  (голубой)
Успех:          #00ff9d  (зелёный)
Опасность:      #ff3b5c  (красный)
Предупреждение: #ffb800  (жёлтый)
Фон карточки:   rgba(255,255,255,0.03)

Шрифты:
  Orbitron  — заголовки, числа, лейблы колонок
  Exo 2     — основной текст

Компоненты:
  .cyber-card   — карточка с полоской accent 3px сверху
  .cyber-btn    — кнопка
  .cyber-title  — заголовок секции (uppercase, letter-spacing)
  .badge-ok / .badge-danger / .badge-warn — статусные бейджи
  .progress-bar-wrap / .fill — прогресс-бар
```

---

## Что переделать постранично

### Общий layout /admin/page.tsx

- Фон: `var(--bg)` (#06060f) + ambient orbs + сетка как на /dashboard
- Заголовок «Панель администратора»: Orbitron, белый
- Навигация по табам: активный таб — линия accent снизу, как в /review
- Кнопки в шапке:
  - «Синхронизировать Redmine» → `.cyber-btn` голубой (accent)
  - «Запустить напоминания» → `.cyber-btn` жёлтый (warn)

---

### Таб «Обзор»

- Stat-карточки → `.cyber-card`, число в Orbitron крупное, подпись мелко Exo 2
- История синхронизаций → `.cyber-card`, таблица тёмная
- Прогресс отчётов → `.progress-bar-wrap / .fill`
- Разбивка по подразделениям → `.cyber-card` на каждое

---

### Таб «Периоды»

- Каждый период → `.cyber-card`
- Статусы: draft/active/review/closed → `.badge-warn` / `.badge-ok` / и т.д.
- Кнопки → `.cyber-btn`

---

### Таб «Сотрудники»

- Таблица → тёмный стиль (см. ниже)
- Без Telegram → `.badge-danger`
- Все заполнены → `.badge-ok` с текстом «Все заполнены»

---

### Таб «Подчинённость»

- Заголовок «МАТРИЦА ПОДЧИНЕНИЯ» → `.cyber-title`
- Строка «91 должностей · 91 в KPI_Mapping» → мелкий серый текст
- Кнопка «Обновить» → `.cyber-btn` accent (голубой)
- Кнопка «Импорт из People» → `.cyber-btn` accent3 (зелёный)
- Таблица → тёмный стиль (см. ниже)
- Колонка «Руководитель»:
  - Имя руководителя → accent цвет (#00e5ff)
  - «— директор —» → серый, курсив
  - «— не задан —» → danger цвет (#ff3b5c)
- Кнопка «Изменить» в каждой строке → маленький outline-вариант

---

### Таб «Аудит»

- Таблица → тёмный стиль
- Временны́е метки → Orbitron, серый
- Типы действий → `.badge-*`

---

## Единый стиль таблиц (применить везде)

```css
table {
  width: 100%;
  border-collapse: collapse;
}

thead th {
  font-family: 'Orbitron', monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);           /* #00e5ff */
  border-bottom: 1px solid rgba(0,229,255,0.2);
  padding: 10px 16px;
  text-align: left;
  font-weight: 500;
}

tbody tr {
  border-bottom: 1px solid rgba(255,255,255,0.05);
  transition: background 0.15s;
}

tbody tr:hover {
  background: rgba(0,229,255,0.04);
}

tbody td {
  padding: 12px 16px;
  font-family: 'Exo 2', sans-serif;
  font-size: 14px;
  color: rgba(255,255,255,0.85);
}
```

---

## Варианты кнопок

```css
/* Accent — основные действия */
background: rgba(0,229,255,0.1);
border: 1px solid rgba(0,229,255,0.4);
color: #00e5ff;

/* Success — импорт, загрузка */
background: rgba(0,255,157,0.1);
border: 1px solid rgba(0,255,157,0.4);
color: #00ff9d;

/* Warn — напоминания */
background: rgba(255,184,0,0.1);
border: 1px solid rgba(255,184,0,0.4);
color: #ffb800;

/* Outline small — «Изменить» в таблицах */
background: transparent;
border: 1px solid rgba(255,255,255,0.15);
color: rgba(255,255,255,0.6);
font-size: 12px;
padding: 4px 10px;
/* hover: border-color accent, color accent */
```

---

## Чеклист готовности

- [ ] Фон всех табов — #06060f, нет белых областей
- [ ] Заголовки — Orbitron
- [ ] Заголовки колонок таблиц — Orbitron uppercase accent
- [ ] Строки таблиц — тёмные с hover
- [ ] Все кнопки — cyber-стиль нужного цвета
- [ ] Карточки — .cyber-card с полоской сверху
- [ ] Статусы — .badge-*
- [ ] Ambient orbs/сетка — как на /dashboard
- [ ] Мобильный вид не сломан

## Не трогать
- Логику, данные, API-запросы
- Компонент диагностики (data-health) — его дизайн отдельно
- Файлы вне `frontend/src/app/admin/`
