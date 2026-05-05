# Задача: KPI Конструктор — БД и API (Этап 1)
> Для Claude Code | Прочитай docs/BL_kpi_constructor.md перед началом
> НЕ делать UI — только БД и API

---

## ЭТАП 1 — СТРУКТУРА БД (Alembic миграция)

### Таблица `kpi_indicators` — библиотека показателей
```sql
CREATE TABLE kpi_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR UNIQUE,                    -- IND_001, IND_COMMON_001
    name TEXT NOT NULL,                     -- название показателя
    formula_type VARCHAR NOT NULL,          -- binary_auto|binary_manual|threshold|multi_threshold|quarterly_threshold
    is_common BOOLEAN DEFAULT FALSE,        -- общий для всех должностей
    is_editable_per_role BOOLEAN DEFAULT TRUE, -- можно ли переопределить в карточке
    status VARCHAR DEFAULT 'draft',         -- draft|active|archived
    version INTEGER DEFAULT 1,
    valid_from DATE,
    valid_to DATE,                          -- NULL = текущая версия
    created_by VARCHAR,                     -- login создателя
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Таблица `kpi_criteria` — критерии и формулы показателя
```sql
CREATE TABLE kpi_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id UUID REFERENCES kpi_indicators(id),
    criterion TEXT NOT NULL,                -- текст критерия оценки
    numerator_label TEXT,                   -- подпись числителя (для threshold)
    denominator_label TEXT,                 -- подпись знаменателя
    thresholds JSONB,                       -- [{condition, score}]
    sub_indicators JSONB,                   -- для multi_threshold: [{label, numerator_label, denominator_label, thresholds}]
    quarterly_thresholds JSONB,             -- для quarterly_threshold: {Q1: {}, Q2: {}, Q3: {}, Q4: {}}
    cumulative BOOLEAN DEFAULT FALSE,       -- нарастающим итогом
    plan_value VARCHAR,                     -- целевое значение (текст)
    common_text_positive TEXT,              -- для is_common: текст при выполнении
    common_text_negative TEXT,              -- для is_common: текст при невыполнении
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Таблица `kpi_role_cards` — карточки должностей
```sql
CREATE TABLE kpi_role_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id INTEGER NOT NULL,
    role_id VARCHAR NOT NULL,
    role_name TEXT,
    version INTEGER DEFAULT 1,
    status VARCHAR DEFAULT 'draft',         -- draft|active|archived
    valid_from DATE,
    valid_to DATE,
    created_by VARCHAR,
    approved_by VARCHAR,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Таблица `kpi_role_card_indicators` — показатели в карточке
```sql
CREATE TABLE kpi_role_card_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES kpi_role_cards(id) ON DELETE CASCADE,
    indicator_id UUID REFERENCES kpi_indicators(id),
    criterion_id UUID REFERENCES kpi_criteria(id),
    weight INTEGER NOT NULL,                -- вес показателя (сумма по карточке = 100)
    order_num INTEGER DEFAULT 0,            -- порядок отображения
    -- override полей для конкретной должности (если is_editable_per_role)
    override_criterion TEXT,
    override_thresholds JSONB,
    override_weight INTEGER
);
```

### Таблица `kpi_change_requests` — запросы на изменение
```sql
CREATE TABLE kpi_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR NOT NULL,                  -- new_indicator|edit_indicator|add_to_card|remove_from_card
    entity_id UUID,                         -- id изменяемого объекта
    payload JSONB NOT NULL,                 -- предлагаемые изменения
    status VARCHAR DEFAULT 'pending',       -- pending|approved|rejected
    requested_by VARCHAR NOT NULL,          -- login инициатора
    reviewed_by VARCHAR,                    -- login HR/admin
    review_comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## ЭТАП 2 — API ЭНДПОИНТЫ

Все эндпоинты в `backend/app/api/kpi_constructor.py`

### Библиотека показателей

```
GET  /api/kpi/indicators              — список всех показателей
     ?status=active|draft|all
     ?formula_type=threshold
     ?is_common=true|false
     
POST /api/kpi/indicators              — создать показатель (draft)
     Роли: manager, hr, admin
     
GET  /api/kpi/indicators/{id}         — детали показателя
PUT  /api/kpi/indicators/{id}         — редактировать (только draft)
     is_common: только hr, admin
     
DELETE /api/kpi/indicators/{id}       — удалить
     Проверить: не используется в role_cards
     Если используется → 400 с перечнем карточек
     
POST /api/kpi/indicators/{id}/approve — утвердить (только admin)
     draft → active, valid_from = начало следующего периода
     
POST /api/kpi/indicators/{id}/reject  — вернуть на доработку (hr, admin)
     Тело: {"comment": "причина"}
```

### Карточки должностей

```
GET  /api/kpi/cards                   — список карточек
     ?pos_id=1                        — фильтр по должности
     manager видит: свою + подчинённых
     hr, admin видят: все
     
GET  /api/kpi/cards/{pos_id}/active   — активная карточка для должности
POST /api/kpi/cards                   — создать новую версию карточки

POST /api/kpi/cards/{id}/indicators   — добавить показатель в карточку
     Тело: {indicator_id, criterion_id, weight, order_num}
     Валидация: сумма весов ≤ 100
     
DELETE /api/kpi/cards/{id}/indicators/{indicator_id} — удалить из карточки
PUT    /api/kpi/cards/{id}/indicators/{indicator_id} — изменить вес/порядок

POST /api/kpi/cards/{id}/approve      — утвердить карточку (только admin)
     Текущая active → archived (valid_to = сегодня)
     Новая → active (valid_from = начало следующего периода)

GET  /api/kpi/cards/{id}/validate     — проверить карточку
     Возвращает: {valid: bool, errors: [], warnings: []}
     Проверки:
       - сумма весов = 100
       - нет дублей показателей
       - все обязательные поля заполнены
```

### Импорт из xlsx

```
POST /api/kpi/import/xlsx             — импорт текущего KPI_Mapping.xlsx
     Только admin
     Создаёт indicators + criteria + role_cards из xlsx
     Статус = active (первоначальный импорт)
     Возвращает: {imported_indicators: N, imported_cards: N, errors: []}
```

---

## ЭТАП 3 — ИМПОРТ ИЗ XLSX

Написать скрипт импорта `backend/app/services/kpi_import_service.py`:

```python
class KpiImportService:
    def import_from_xlsx(self, xlsx_path: str) -> dict:
        """
        Читает KPI_Mapping.xlsx и создаёт записи в новых таблицах.
        
        Логика:
        1. Для каждой уникальной комбинации (indicator + formula_type) 
           → создать kpi_indicators запись
        2. Для каждой строки → создать kpi_criteria
        3. Для каждого pos_id → создать kpi_role_cards
        4. Для каждой строки → создать kpi_role_card_indicators
        
        Общие показатели (is_common=True) → один indicator, 
        привязан к множеству карточек.
        """
```

Поля маппинга из xlsx:
```
indicator      → kpi_indicators.name
formula_type   → kpi_indicators.formula_type  
is_common      → kpi_indicators.is_common
criterion      → kpi_criteria.criterion
weight         → kpi_role_card_indicators.weight
thresholds     → kpi_criteria.thresholds (парсить строку)
formula_desc   → kpi_criteria.numerator_label + denominator_label (парсить)
cumulative     → kpi_criteria.cumulative
```

---

## Чеклист
- [ ] Alembic миграция создаёт 5 таблиц
- [ ] `GET /api/kpi/indicators` возвращает список
- [ ] `POST /api/kpi/indicators` создаёт показатель
- [ ] `DELETE` проверяет использование в карточках
- [ ] `GET /api/kpi/cards/{pos_id}/active` возвращает активную карточку
- [ ] `POST /api/kpi/cards/{id}/indicators` добавляет с валидацией суммы весов
- [ ] `POST /api/kpi/import/xlsx` импортирует текущий xlsx
- [ ] Запустить импорт и убедиться что 91 карточка создана
- [ ] UI — НЕ делать (следующий этап)
