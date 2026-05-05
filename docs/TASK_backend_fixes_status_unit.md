# ЗАДАЧА: Три бэкенд-фикса — статус карточки, unit_name, общие показатели

> Файл для Claude Code | Дата: 2026-05-04 | Приоритет: 🔴

---

## БАГ 1 — «Карточка должна быть в статусе draft» при добавлении показателя

### Проблема
При попытке добавить показатель в карточку бэкенд возвращает ошибку:
«Карточка должна быть в статусе draft»

Карточки создаются со статусом `active` — поэтому добавить показатели невозможно.

### Решение
Найти в `backend/app/api/admin.py` или `kpi_constructor.py` проверку:
```python
if card.status != 'draft':
    raise HTTPException(400, "Карточка должна быть в статусе draft")
```

**Закомментировать** с TODO-меткой:
```python
# TODO: АУДИТ 2026-05-04 — проверка статуса карточки временно отключена
# if card.status != 'draft':
#     raise HTTPException(400, "Карточка должна быть в статусе draft")
```

Также проверить эндпоинт сохранения весов карточки — там может быть такая же проверка.

---

## БАГ 2 — `unit_name` не сохраняется в БД

### Проблема
Поле «УПРАВЛЕНИЕ» в форме показателя не сохраняется.
SQL-проверка показала что `unit_name = NULL` у всех показателей.

### Диагностика
```bash
# Проверить есть ли колонка unit_name в таблице
docker compose exec postgres psql -U kpi_user -d kpi_portal -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'kpi_indicators' AND column_name = 'unit_name';
"
```

Если колонки нет — значит миграция не применилась. Применить:
```bash
docker compose exec backend alembic upgrade head
```

Если колонка есть — проверить передаётся ли `unit_name` в модель при PATCH:
```python
# В update_indicator:
ind.unit_name = body.unit_name  # ← это есть?
```

---

## БАГ 3 — Общие показатели не добавляются автоматически при создании карточки

### Проблема
При создании новой карточки (через wizard) общие показатели не добавляются.

### Диагностика
Проверить эндпоинт `POST /api/admin/kpi-cards/` — вызывается ли логика добавления is_common:
```python
# Должно быть после создания карточки:
common = await db.execute(
    select(KpiIndicator).where(
        KpiIndicator.is_common == True,
        KpiIndicator.status == 'active'
    )
)
for ind in common.scalars():
    db.add(KpiRoleCardIndicator(...))
```

Возможная причина: показатели были `draft` когда создавалась карточка,
поэтому фильтр `status == 'active'` не нашёл их.

### Решение
1. Убедиться что логика автодобавления is_common есть в POST /kpi-cards/
2. Добавить эндпоинт `POST /api/admin/kpi-cards/{pos_id}/sync-common` для ручной синхронизации
3. Добавить кнопку «+ Добавить общие показатели» в UI карточки

---

## ФАЙЛЫ

```
backend/app/api/admin.py
backend/app/services/kpi_constructor.py
backend/alembic/versions/   ← проверить что миграция с unit_name применилась
```

## ПОСЛЕ ВЫПОЛНЕНИЯ

Проверить через SQL:
```sql
-- unit_name колонка существует
SELECT column_name FROM information_schema.columns
WHERE table_name = 'kpi_indicators' AND column_name = 'unit_name';

-- Карточка pos_id=1 имеет общие показатели
SELECT i.name, i.is_common, rci.weight
FROM kpi_role_card_indicators rci
JOIN kpi_indicators i ON i.id = rci.indicator_id
WHERE rci.card_id = (SELECT id FROM kpi_role_cards WHERE pos_id = 1 LIMIT 1);
```
