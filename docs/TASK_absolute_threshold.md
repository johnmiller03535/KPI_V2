# ЗАДАЧА: Новый тип absolute_threshold + исправление данных показателей

> Файл для Claude Code | Дата: 2026-05-04 | Приоритет: 🔴
> Основание: BL_indicator_types.md v3.0

---

## КОНТЕКСТ

В результате аудита данных выявлено:
1. Часть threshold-показателей используют абсолютные числа (не %) → нужен новый тип
2. Часть threshold-показателей без порогов → нужно перевести в binary_manual
3. Нужно добавить поддержку нового типа в конструктор форм

---

## ЧАСТЬ 1 — Миграция БД

Создать новую миграцию Alembic:

```python
# Новое значение enum
op.execute("ALTER TYPE formula_type ADD VALUE IF NOT EXISTS 'absolute_threshold'")

# Новые поля в kpi_criteria
op.add_column('kpi_criteria', sa.Column('value_label', sa.String(), nullable=True))
op.add_column('kpi_criteria', sa.Column('is_quarterly', sa.Boolean(), server_default='false', nullable=False))
```

### Обновить данные существующих показателей

**4 показателя: threshold → binary_manual** (нет числовых порогов в методике):
```sql
-- Найти по частичному совпадению имени (точные имена могут отличаться)
UPDATE kpi_indicators SET formula_type = 'binary_manual'
WHERE name ILIKE '%Оптимизация локальных актов Учреждения%'
   OR name ILIKE '%Своевременная подготовка заключений по проектам нормативных правовых актов%'
   OR name ILIKE '%Соблюдение%сроков%подготовки ответов%'
   OR name ILIKE '%Обеспечение моделирования бизнес-процессов%';

-- Проверить что обновилось ровно 4 строки
SELECT name, formula_type FROM kpi_indicators
WHERE name ILIKE '%Оптимизация локальных актов%'
   OR name ILIKE '%Своевременная подготовка заключений%нормативных%'
   OR name ILIKE '%сроков%подготовки ответов%'
   OR name ILIKE '%моделирования бизнес-процессов%';
```

**5 показателей: threshold/quarterly_threshold → absolute_threshold**:
```sql
UPDATE kpi_indicators SET formula_type = 'absolute_threshold'
WHERE name ILIKE '%Правовая экспертиза проектов локальных актов%'
   OR name ILIKE '%Оптимизация выпуска документов%'
   OR name ILIKE '%Подготовка аналитических материалов по ЗИТ%'
   OR name ILIKE '%Подготовка информационных материалов по популяризации ЗИТ%'
   OR name ILIKE '%Количество участников на торгах по Московской области%';

-- Для квартального абсолютного — обновить критерий с is_quarterly=true
UPDATE kpi_criteria SET is_quarterly = true
WHERE indicator_id = (
  SELECT id FROM kpi_indicators
  WHERE name ILIKE '%Количество участников на торгах по Московской области%'
  LIMIT 1
);

-- Проверить результат
SELECT name, formula_type FROM kpi_indicators
WHERE formula_type = 'absolute_threshold';
```

**Заполнить пороги для 3 показателей без порогов (переведённых в binary_manual)**:
```sql
-- После перевода в binary_manual пороги не нужны — можно оставить пустыми
-- Но нужно убедиться что thresholds = NULL или []
UPDATE kpi_criteria SET thresholds = NULL
WHERE indicator_id IN (
  SELECT id FROM kpi_indicators
  WHERE formula_type = 'binary_manual'
    AND name ILIKE ANY(ARRAY[
      '%Оптимизация локальных актов%',
      '%Своевременная подготовка заключений%нормативных%',
      '%сроков%подготовки ответов%',
      '%моделирования бизнес-процессов%'
    ])
);
```

---

## ЧАСТЬ 2 — Backend: поддержка нового типа

### Схема (`backend/app/schemas/admin.py`)
Добавить `'absolute_threshold'` в Literal/Enum для `formula_type`.

### API GET /api/admin/indicators/
Убедиться что `absolute_threshold` показатели возвращаются в списке.

### KpiMappingService (`backend/app/services/kpi_mapping_service.py`)
В методе `get_kpi_structure(role_id)` добавить `absolute_threshold` в категорию числовых:
```python
# absolute_threshold идёт в ту же группу что threshold — сотрудник вводит данные
numeric_types = ('threshold', 'multi_threshold', 'quarterly_threshold', 'absolute_threshold')
```

### ThresholdParser (`backend/app/services/threshold_parser.py`)
Добавить метод для абсолютных значений:
```python
def apply_absolute_threshold(value: float, rules: list[ThresholdRule]) -> float:
    """Применяет пороги к абсолютному значению (без деления на знаменатель)."""
    for rule in rules:
        if rule.matches(value):  # сравниваем value напрямую, не как %
            return rule.score
    return 0.0
```

Для квартальных абсолютных — та же логика определения квартала что в `quarterly_threshold`.

---

## ЧАСТЬ 3 — Frontend: конструктор форм

### Добавить `absolute_threshold` в select типов
```typescript
{ value: 'absolute_threshold', label: 'Абсолютный (absolute_threshold)' }
```

Описание под select:
```
«Сотрудник вводит одно число. Система сравнивает его с порогами напрямую (без деления)»
```

### Форма для absolute_threshold

После общих полей (название, группа, критерий):

```
ЧИСЛОВОЙ ПОКАЗАТЕЛЬ

ПОДПИСЬ ПОЛЯ ВВОДА *
[_________________________________]
Подсказка: Как называется вводимое значение. Пример: «Количество материалов»,
           «Среднее число участников», «Количество повторных согласований»

☐ Нарастающим итогом
☐ Квартальные пороги (разные условия для Q1/Q2/Q3/Q4)
```

**Если «Квартальные пороги» НЕ выбран:**
```
ПРАВИЛА ОЦЕНКИ *
┌──────────────────────────────────┐
│  [<= ▼] [ 2 ]  →  [100]  🗑     │
│  [>  ▼] [ 2 ]  →  [  0]  🗑     │
└──────────────────────────────────┘
[+ Добавить правило]
```
Значение — это абсолютное число (не %).

**Если «Квартальные пороги» выбран:**
```
ПРАВИЛА ПО КВАРТАЛАМ *
[Q1]──[Q2]──[Q3]──[Q4]

Q1:
┌──────────────────────────────────┐
│  [>= ▼] [ 2.7 ]  →  [100]  🗑   │
│  [<  ▼] [ 2.7 ]  →  [  0]  🗑   │
└──────────────────────────────────┘
[Скопировать Q1 во все →]
```

**Важно:** убрать символ `%` из строк правил для `absolute_threshold` — там не проценты, а абсолютные значения. Визуально:
```
threshold:          [>= ▼] [ 67 ] %→ [100]   ← символ %
absolute_threshold: [>= ▼] [ 3  ]  → [100]   ← без %
```

### Отображение в списке показателей
Бейдж типа: `Абсолютный` (отдельный цвет, например оранжевый `--warn`)

---

## ЧАСТЬ 4 — Валидация для нового типа

| Поле | Ошибка |
|---|---|
| value_label пустой | «Укажите подпись поля ввода» |
| Нет ни одного правила | «Добавьте хотя бы одно правило оценки» |
| Нет правила с баллом 0 | «Добавьте правило для минимального балла (0)» |
| Квартальные пороги: хотя бы 1 таб пуст | «Заполните правила для всех кварталов» |

---

## ФАЙЛЫ К ИЗМЕНЕНИЮ

```
backend/alembic/versions/    ← новая миграция
backend/app/schemas/admin.py ← новый тип в enum
backend/app/services/kpi_mapping_service.py  ← absolute в numeric
backend/app/services/threshold_parser.py     ← apply_absolute_threshold
frontend/src/app/admin/page.tsx              ← конструктор форм
```

---

## ПРОВЕРКА ПОСЛЕ ВЫПОЛНЕНИЯ

```sql
-- Итоговое распределение типов должно быть:
SELECT formula_type, COUNT(*)
FROM kpi_indicators
WHERE status = 'active'
GROUP BY formula_type ORDER BY count DESC;

-- Ожидаемо:
-- binary_auto        69
-- threshold          ~38  (было 44, минус 5 absolute + минус 1 binary_manual)
-- multi_threshold    ~4   (было 6, минус 2 absolute)
-- binary_manual      ~7   (было 3, плюс 4)
-- quarterly_threshold ~1  (было 2, минус 1 absolute)
-- absolute_threshold  5   (новые)
```
