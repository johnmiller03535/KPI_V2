# ЗАДАЧА: Крупные улучшения KPI-конструктора

> Файл для Claude Code | Дата: 2026-05-04 | Приоритет: 🔴
> Основание: аудит показателей 2026-05-04

---

## ЧАСТЬ 1 — Привязка показателей к управлениям

### Проблема
Сейчас показатели группируются по тематическим группам (Проектная деятельность, Закупочная).
Нужна **дополнительная привязка к управлению** — специфические показатели принадлежат
конкретным управлениям. Это нужно для:
- Фильтрации при добавлении показателя в карточку
- Поиска нужного показателя по управлению, а внутри — по тематике

### Решение

#### БД — новое поле
```sql
ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS unit_name VARCHAR DEFAULT NULL;
-- unit_name: название управления верхнего уровня (или NULL если показатель общий)
-- Примеры: 'Правовое управление', 'Управление анализа и автоматизации данных', NULL
```

#### Backend
Добавить `unit_name: str | None = None` в схемы `IndicatorCreate`, `IndicatorUpdate`, `IndicatorResponse`.
Передавать в API.

#### Frontend — таб «KPI-показатели»

**Левая панель** — добавить переключатель над списком групп:

```
[По группам ▾] [По управлениям]    ← переключатель

── Режим «По группам» (текущий) ──
Все показатели         132
★ Общие показатели       3
📋 Проектная деят.       5
...

── Режим «По управлениям» ──
Все показатели         132
Без управления          XX   ← is_common + общие
─────────────────────────────
Правовое управление      14
  📋 Правовое обесп.      8   ← подгруппы внутри управления
  📋 Документооборот       6
─────────────────────────────
Управление анализа...    20
  📋 Аналитическая дея.  20
...
```

**Форма создания/редактирования показателя** — добавить поле:
```
УПРАВЛЕНИЕ
[выпадающий список всех управлений из subordination ▼]
[Без привязки к управлению (общий)]
Подсказка: Укажите управление которому специфически принадлежит показатель
```

---

## ЧАСТЬ 2 — Поля для PDF у binary_manual показателей

### Проблема
При генерации PDF нужен текст что писать при ✅ и при ❌.
Сейчас этих полей нет.

### Решение

#### БД
```sql
ALTER TABLE kpi_criteria ADD COLUMN IF NOT EXISTS positive_text TEXT DEFAULT NULL;
ALTER TABLE kpi_criteria ADD COLUMN IF NOT EXISTS negative_text TEXT DEFAULT NULL;
-- positive_text: текст при выполнении (✅)
-- negative_text: текст при невыполнении (❌)
-- Для binary_manual и multi_binary
```

#### Frontend — форма создания/редактирования

Для типов `binary_manual` и `multi_binary` — добавить секцию после «Критерия оценки»:

```
ТЕКСТ ДЛЯ ОТЧЁТА (необязательно)
Подсказка: Эти тексты будут использованы при генерации PDF-отчёта

При выполнении ✅:
[textarea]
Пример: «Показатель выполнен. Нарушений трудового распорядка не зафиксировано»

При невыполнении ❌:
[textarea]
Пример: «Показатель не выполнен. Зафиксировано нарушение трудового распорядка»
```

Для `multi_binary` — общие поля positive/negative_text на уровне всего показателя
(не на уровне каждого подпоказателя).

#### Просмотр показателя
Если заполнены — показывать в модалке просмотра в отдельной секции «ТЕКСТ В ОТЧЁТЕ»:
```
ТЕКСТ В ОТЧЁТЕ
✅ Показатель выполнен. Нарушений не зафиксировано.
❌ Показатель не выполнен. Зафиксировано нарушение.
```

---

## ЧАСТЬ 3 — Редактирование показателя из KPI-карточки

### Проблема
В табе «KPI-карточки» при редактировании карточки пользователь видит список показателей
с весами, но не может ни просмотреть детали показателя, ни отредактировать его.

Для проведения аудита нужно иметь возможность прямо из карточки:
1. Просмотреть детали показателя
2. Перейти к редактированию показателя
3. Добавить показатель в карточку с поиском по управлению/группе

### Решение

#### 3.1 Кнопка «Просмотр» у каждого показателя в карточке

В режиме просмотра карточки (не редактирования) — добавить кнопку рядом с названием:
```
┌──────────────────────────────────────────────────────┐
│ Обеспечение проектной деятельности  [Авто]  20%  👁  │
│ Обеспечение бизнес-анализа          [Авто]  15%  👁  │
└──────────────────────────────────────────────────────┘
```

Клик на 👁 → открывает модалку просмотра показателя (та же что в KPI-показатели)
с кнопкой «Редактировать» внутри.

В режиме редактирования карточки — та же кнопка 👁 рядом с названием, плюс уже есть корзина.

#### 3.2 Улучшить диалог «+ Добавить показатель»

Сейчас неизвестно как выглядит диалог добавления показателя в карточку.
Нужно чтобы он имел:
- Поиск по названию
- Фильтр по управлению (новое поле `unit_name`)
- Фильтр по группе (существующее `indicator_group`)
- Список результатов с типом и кратким критерием
- Показатели уже добавленные в карточку — отмечены галочкой, недоступны для повторного добавления

```
ДОБАВИТЬ ПОКАЗАТЕЛЬ

[Поиск по названию...          ]

[Управление ▼]  [Группа ▼]

─────────────────────────────────────
✓ Обеспечение проектной деятельности   [Авто]  ← уже в карточке, disabled
  Обеспечение бизнес-анализа           [Авто]  [+ Добавить]
  Отсутствие нарушений сроков          [Авто]  [+ Добавить]
─────────────────────────────────────
```

---

## ЧАСТЬ 4 — Рефакторинг форм (вынести в компоненты)

### Проблема
`admin/page.tsx` стал очень большим. Формы для каждого типа показателя встроены inline.
Это затрудняет поддержку и поиск багов.

### Решение — разбить на компоненты

```typescript
// Вынести в отдельные файлы:

// frontend/src/components/admin/IndicatorFormModal.tsx
// Полная форма создания/редактирования показателя
// Содержит switch по formula_type → рендерит нужную секцию

// frontend/src/components/admin/indicator-forms/BinaryForm.tsx
// Форма для binary_auto, binary_manual

// frontend/src/components/admin/indicator-forms/MultiBinaryForm.tsx
// Форма для multi_binary с подпоказателями

// frontend/src/components/admin/indicator-forms/ThresholdForm.tsx
// Форма для threshold (числитель/знаменатель/пороги)

// frontend/src/components/admin/indicator-forms/MultiThresholdForm.tsx
// Форма для multi_threshold

// frontend/src/components/admin/indicator-forms/QuarterlyThresholdForm.tsx
// Форма для quarterly_threshold (4 таба)

// frontend/src/components/admin/indicator-forms/AbsoluteThresholdForm.tsx
// Форма для absolute_threshold

// frontend/src/components/admin/ThresholdRulesEditor.tsx
// Визуальный редактор правил — переиспользуется во всех threshold-формах

// frontend/src/components/admin/IndicatorViewModal.tsx
// Модалка просмотра показателя
```

**Важно:** при рефакторинге не менять бизнес-логику — только разбить на файлы.
После разбивки убедиться что все 6 типов создаются/редактируются корректно.

---

## ЧАСТЬ 5 — Проверка консистентности БД

Выполнить SQL-проверки и вывести результат в лог:

```sql
-- 1. Показатели с formula_type из kpi_criteria которые не соответствуют типу
SELECT i.id, i.name, i.formula_type,
       COUNT(c.id) as criteria_count,
       COUNT(CASE WHEN c.sub_type = 'sub_binary' THEN 1 END) as sub_binary_count,
       COUNT(CASE WHEN c.sub_type = 'sub_numeric' THEN 1 END) as sub_numeric_count
FROM kpi_indicators i
LEFT JOIN kpi_criteria c ON c.indicator_id = i.id
WHERE i.status = 'active'
GROUP BY i.id, i.name, i.formula_type
HAVING
  -- multi_binary должен иметь sub_binary подпоказатели
  (i.formula_type = 'multi_binary' AND COUNT(CASE WHEN c.sub_type = 'sub_binary' THEN 1 END) < 2)
  OR
  -- multi_threshold должен иметь sub_numeric подпоказатели
  (i.formula_type = 'multi_threshold' AND COUNT(CASE WHEN c.sub_type = 'sub_numeric' THEN 1 END) < 2)
  OR
  -- threshold должен иметь хотя бы один критерий
  (i.formula_type IN ('threshold', 'absolute_threshold', 'quarterly_threshold')
   AND COUNT(c.id) = 0);

-- 2. Карточки с суммой весов != 100
SELECT rc.id, rc.position_name, SUM(rci.weight) as total
FROM kpi_role_cards rc
JOIN kpi_role_card_indicators rci ON rci.card_id = rc.id
GROUP BY rc.id, rc.position_name
HAVING SUM(rci.weight) != 100;

-- 3. Показатели в карточках которые больше не существуют
SELECT rci.id, rci.card_id, rci.indicator_id
FROM kpi_role_card_indicators rci
LEFT JOIN kpi_indicators i ON i.id = rci.indicator_id
WHERE i.id IS NULL;

-- 4. Дублирующиеся показатели в одной карточке
SELECT card_id, indicator_id, COUNT(*) as cnt
FROM kpi_role_card_indicators
GROUP BY card_id, indicator_id
HAVING COUNT(*) > 1;
```

Вывести результаты в файл `/mnt/user-data/outputs/db_consistency_report.txt`.
Если проблемы найдены — вывести детально что именно.

---

## ЧАСТЬ 6 — Проверка связей KPI-показатели и KPI-карточки

```sql
-- Показатели без ни одной карточки (active, не is_common)
SELECT i.id, i.name, i.formula_type, i.indicator_group
FROM kpi_indicators i
WHERE i.status = 'active'
  AND i.is_common = false
  AND NOT EXISTS (
    SELECT 1 FROM kpi_role_card_indicators rci WHERE rci.indicator_id = i.id
  )
ORDER BY i.indicator_group;

-- Карточки без специфических показателей (только общие)
SELECT rc.id, rc.position_name, rc.department,
       COUNT(rci.id) as total,
       COUNT(CASE WHEN i.is_common THEN 1 END) as common_count
FROM kpi_role_cards rc
LEFT JOIN kpi_role_card_indicators rci ON rci.card_id = rc.id
LEFT JOIN kpi_indicators i ON i.id = rci.indicator_id
GROUP BY rc.id, rc.position_name, rc.department
HAVING COUNT(rci.id) = COUNT(CASE WHEN i.is_common THEN 1 END);
```

Также включить в отчёт.

---

## ФАЙЛЫ К ИЗМЕНЕНИЮ

```
backend/alembic/versions/          ← миграция: unit_name, positive_text, negative_text
backend/app/schemas/admin.py       ← новые поля
backend/app/api/admin.py           ← передавать новые поля

frontend/src/app/admin/page.tsx    ← интеграция компонентов
frontend/src/components/admin/     ← новая папка с компонентами:
  IndicatorFormModal.tsx
  IndicatorViewModal.tsx
  ThresholdRulesEditor.tsx
  indicator-forms/
    BinaryForm.tsx
    MultiBinaryForm.tsx
    ThresholdForm.tsx
    MultiThresholdForm.tsx
    QuarterlyThresholdForm.tsx
    AbsoluteThresholdForm.tsx
```

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

1. Сначала миграция БД (unit_name, positive_text, negative_text)
2. Backend схемы и API
3. Рефакторинг форм (Часть 4) — без изменения логики
4. Добавить unit_name в форму и панель (Часть 1)
5. Добавить positive_text/negative_text (Часть 2)
6. Кнопка 👁 и улучшенный диалог добавления (Часть 3)
7. Проверки БД (Части 5 и 6)

---

## ВАЖНО

- При рефакторинге (Часть 4) сначала перенести код, убедиться что всё работает,
  только потом добавлять новую функциональность
- Все формы должны корректно работать для всех 7 типов показателей
- TODO-метки аудита оставить — их уберём после завершения аудита
