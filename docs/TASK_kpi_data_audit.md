# ЗАДАЧА: Диагностика данных KPI-показателей в БД

> Файл для Claude Code | Дата: 2026-05-03 | Приоритет: 🔴

---

## ЦЕЛЬ

Проверить что все 124 показателя из KPI_Mapping.xlsx корректно легли в БД.
Сгенерировать отчёт в виде CSV и текстового summary для ручной проверки в UI.

---

## ШАГ 1 — Общая статистика

```sql
-- Сколько показателей по типу
SELECT formula_type, COUNT(*) as cnt
FROM kpi_indicators
GROUP BY formula_type
ORDER BY cnt DESC;

-- Сколько по группе
SELECT indicator_group, formula_type, COUNT(*) as cnt
FROM kpi_indicators
GROUP BY indicator_group, formula_type
ORDER BY indicator_group, formula_type;

-- Общие показатели
SELECT id, name, formula_type, indicator_group
FROM kpi_indicators
WHERE is_common = true;

-- Показатели без критерия
SELECT id, name, formula_type
FROM kpi_indicators
WHERE id NOT IN (SELECT DISTINCT indicator_id FROM kpi_criteria)
ORDER BY formula_type;

-- Показатели без числителя/знаменателя (для threshold-типов)
SELECT i.id, i.name, i.formula_type,
       c.numerator_label, c.denominator_label
FROM kpi_indicators i
JOIN kpi_criteria c ON c.indicator_id = i.id
WHERE i.formula_type IN ('threshold', 'multi_threshold', 'quarterly_threshold')
  AND (c.numerator_label IS NULL OR c.numerator_label = ''
    OR c.denominator_label IS NULL OR c.denominator_label = '')
ORDER BY i.formula_type, i.name;

-- Показатели без порогов (для threshold-типов)
SELECT i.id, i.name, i.formula_type
FROM kpi_indicators i
JOIN kpi_criteria c ON c.indicator_id = i.id
WHERE i.formula_type IN ('threshold', 'multi_threshold', 'quarterly_threshold')
  AND (c.thresholds IS NULL OR c.thresholds::text = '[]' OR c.thresholds::text = 'null')
ORDER BY i.formula_type;

-- multi_threshold/multi_binary: сколько подпоказателей у каждого
SELECT i.id, i.name, i.formula_type, COUNT(c.id) as sub_count
FROM kpi_indicators i
LEFT JOIN kpi_criteria c ON c.indicator_id = i.id
WHERE i.formula_type IN ('multi_threshold', 'multi_binary')
GROUP BY i.id, i.name, i.formula_type
ORDER BY i.formula_type, sub_count;
```

---

## ШАГ 2 — Полная выгрузка для проверки

Сгенерировать CSV файл со всеми показателями:

```sql
SELECT
  i.id,
  i.name,
  i.formula_type,
  i.indicator_group,
  i.is_common,
  i.status,
  c.description as criterion,
  c.numerator_label,
  c.denominator_label,
  c.is_cumulative,
  c.thresholds::text as thresholds_json,
  c.sub_type,
  (SELECT COUNT(*) FROM kpi_role_card_indicators rci WHERE rci.indicator_id = i.id) as used_in_cards
FROM kpi_indicators i
LEFT JOIN kpi_criteria c ON c.indicator_id = i.id AND c.sub_type IS NULL
ORDER BY i.indicator_group, i.formula_type, i.name;
```

Сохранить результат в `/mnt/user-data/outputs/kpi_indicators_audit.csv`

---

## ШАГ 3 — Проверка карточек

```sql
-- Карточки с неправильной суммой весов (не 100)
SELECT
  rc.id,
  rc.position_name,
  rc.department,
  SUM(rci.weight) as total_weight
FROM kpi_role_cards rc
JOIN kpi_role_card_indicators rci ON rci.card_id = rc.id
GROUP BY rc.id, rc.position_name, rc.department
HAVING SUM(rci.weight) != 100
ORDER BY rc.position_name;

-- Карточки без показателей
SELECT rc.id, rc.position_name, rc.department
FROM kpi_role_cards rc
LEFT JOIN kpi_role_card_indicators rci ON rci.card_id = rc.id
WHERE rci.id IS NULL;

-- Какие показатели не используются ни в одной карточке
SELECT i.id, i.name, i.formula_type, i.indicator_group
FROM kpi_indicators i
WHERE i.is_common = false
  AND i.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM kpi_role_card_indicators rci WHERE rci.indicator_id = i.id
  )
ORDER BY i.indicator_group;
```

---

## ШАГ 4 — Генерация отчёта

Создать текстовый файл `/mnt/user-data/outputs/kpi_audit_report.md` со следующим содержимым:

```markdown
# Аудит KPI-показателей — {дата}

## Общая статистика
- Всего показателей: X
- По типам: binary_auto=X, binary_manual=X, multi_binary=X, threshold=X, multi_threshold=X, quarterly_threshold=X
- Общих (is_common): X (должно быть 3)
- Активных: X, Draft: X

## Проблемы требующие внимания
### Без числителя/знаменателя (threshold-типы)
[список]

### Без порогов (threshold-типы)
[список]

### Карточки с суммой весов ≠ 100%
[список]

### Показатели не привязанные ни к одной карточке
[список]

## Требуют проверки в UI (все X показателей)
[полный список: id | название | тип | группа | проблемы]
```

---

## ФАЙЛЫ К СОЗДАНИЮ

```
/mnt/user-data/outputs/kpi_indicators_audit.csv    ← полная выгрузка
/mnt/user-data/outputs/kpi_audit_report.md         ← summary с проблемами
```

## КАК ЗАПУСТИТЬ

```bash
docker compose exec backend python -c "
import asyncio
from app.db import get_db
# ... запустить диагностические запросы
"
```

Или через psql напрямую:
```bash
docker compose exec postgres psql -U kpi_user -d kpi_db -f /tmp/audit.sql
```
