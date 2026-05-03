# CLAUDE.md — KPI Портал ГКУ МО «РЦТ»

> Обновляется в конце каждой сессии. Последнее обновление: 2026-05-03 (шаг J2: конструктор 6 типов показателей, тестирование admin-панели завершено)

## О проекте

**Цель:** Веб-приложение для автоматизации KPI-отчётности.  
**Организация:** ГКУ МО «Региональный центр торгов», 91 сотрудник, 9 подразделений.  
**Деплой:** Amvera (Docker Compose).  
**Redmine:** kkp.rm.mosreg.ru — источник первичных данных.

## Технологический стек

| Слой | Технология |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Backend | FastAPI (Python 3.12) |
| БД | PostgreSQL 16 |
| Миграции | Alembic |
| Бот | aiogram 3 |
| Планировщик | APScheduler |
| PDF | WeasyPrint |
| AI | YandexGPT (primary) / GigaChat (fallback, 401) |
| Контейнеры | Docker Compose |
| Авторизация | JWT + Redmine API (единая учётка) |

## Роли пользователей

- `employee` — сотрудник: заполняет KPI-форму
- `manager` — руководитель: проверяет и утверждает отчёты
- `admin` — администратор: управляет периодами, синхронизацией
- `finance` — финансовый блок: просматривает утверждённые отчёты
- *(запланировано)* `hr` — проверяет новые показатели, меняет is_common

## Структура проекта

```
kpi-portal/
├── backend/
│   ├── app/
│   │   ├── api/           ← роутеры (admin.py, review.py, periods.py, ...)
│   │   ├── models/        ← SQLAlchemy модели
│   │   ├── schemas/       ← Pydantic схемы
│   │   ├── services/      ← бизнес-логика
│   │   │   ├── kpi_mapping_service.py
│   │   │   ├── kpi_engine_service.py
│   │   │   ├── threshold_parser.py
│   │   │   ├── kpi_import_service.py
│   │   │   ├── subordination_service.py
│   │   │   └── people_import_service.py
│   │   └── core/          ← auth, dependencies
│   └── alembic/           ← миграции
├── frontend/
│   └── src/
│       ├── app/           ← App Router страницы
│       ├── styles/        ← cyber.css (Dark Cyber дизайн)
│       └── utils/
│           └── admin.ts   ← normalizeUnit(), buildDeptMap(), sortedDeptKeys()
├── docs/                  ← BL-документы
│   ├── BL_subordination.md
│   ├── BL_ai_assessment.md
│   ├── BL_kpi_cards.md
│   ├── BL_kpi_constructor.md
│   ├── BL_numeric_kpi.md       ← читать для шага K
│   ├── BL_admin_structure.md   ← новый (2026-05-02)
│   └── BL_indicator_types.md   ← новый (2026-05-03), 6 типов показателей
├── reference/             ← readonly справочники
│   ├── KPI_Mapping.xlsx
│   ├── subordination.json
│   └── people_export.xlsx
└── docker-compose.yml
```

## Текущий статус этапов

| Этап | Название | Статус |
|---|---|---|
| 0 | Фундамент (Docker, FastAPI, Next.js, PG) | ✅ |
| 1 | Авторизация и роли | ✅ |
| 2 | Синхронизация с Redmine | ✅ |
| 3 | Управление периодами (Админ) | ✅ |
| 4 | KPI-форма сотрудника + AI | ✅ |
| 5 | Дашборд руководителя + утверждение | ✅ |
| 6 | Генерация PDF + запись в Redmine | ✅ |
| 7 | Система напоминаний | ✅ |
| 8 | Telegram-бот (руководители) | ✅ |
| 9 | Панель администратора | ✅ |
| 10 | Финансовый дашборд | ✅ |
| A | Рефакторинг KpiMappingService (5 типов) | ✅ |
| B | KpiEngineService + ThresholdParser | ✅ |
| C | API binary_manual + KPI-форма Dark Cyber | ✅ |
| D | Форма руководителя + PDF таблица KPI | ✅ |
| E | Дашборд Dark Cyber + сквозной цикл | ✅ |
| F | Смена AI: YandexGPT primary + GigaChat fallback | ✅ |
| G | KPI-конструктор: БД + API + UI + импорт xlsx | ✅ |
| H | Подчинённость: таб + импорт из People | ✅ |
| J | Редизайн admin: дерево, сайдбар карточек, wizard | ✅ |
| J2 | Конструктор показателей: 6 типов, визуальный редактор | ✅ |
| **K** | **Числовые KPI в форме сотрудника** | **🔴 Следующий** |

## Ключевые решения (зафиксированные)

- Redmine — единственный источник истины для пользователей, задач и структуры организации
- Должности и подразделения создаются только в Redmine, портал обогащает (KPI-карточки, подчинённость)
- Авторизация: логин/пароль Redmine → JWT (access 15min, refresh 7d)
- БД — только для состояния приложения, кэша и аудита
- PDF через WeasyPrint (HTML-шаблон → PDF)
- Уведомления только через Telegram
- Синхронизация с Redmine — еженедельно (APScheduler)
- Изменения KPI-карточек вступают в силу со **следующего** периода
- Новые показатели создают: начальники управлений + заместители директора

## KPI-конструктор — финальное состояние (2026-05-03)

### БД — 5 таблиц конструктора
- `kpi_indicators` — **124** показателя (исправлена ошибка: было написано 126), 3 общих `is_common=true`
- `kpi_criteria` — критерии + подпоказатели (поля `sub_type`, `order` добавлены в миграции k4l5m6n7o8p9)
- `kpi_role_cards` — 91 карточка должностей
- `kpi_role_card_indicators` — 261 привязка
- `kpi_change_requests` — запросы на изменение
- `subordination` — матрица подчинённости в PostgreSQL (миграция j3k4l5m6n7o8)

### 6 типов показателей (все реализованы в конструкторе)

| Тип | Кто оценивает | Вводит данные | Балл | Особенность |
|---|---|---|---|---|
| binary_auto | AI | — | 0/100 | По трудозатратам Redmine |
| binary_manual | Руководитель | Руководитель (✅/❌) | 0/100 | Одно решение |
| multi_binary | Руководитель | Руководитель (✅/❌ каждый) | 0/100 | N подпоказателей со своим описанием |
| threshold | Система | Сотрудник (числитель + знаменатель) | 0/50/100 | Единые пороги |
| multi_threshold | Система | Сотрудник (по каждому) | 0/100 | N числовых подпоказателей |
| quarterly_threshold | Система | Сотрудник (числитель + знаменатель) | 0/50/100 | Пороги Q1/Q2/Q3/Q4 независимо |

### Workflow новых показателей
```
Начальник управления / Зам. директора  →  создаёт (status=draft)
HR                                     →  проверяет (status=review)   ← UI не реализован
Admin                                  →  утверждает (status=active)  ← UI не реализован
```

### Конструктор форм (frontend)
- Модалка `IndicatorFormModal` с выбором типа + описание типа
- Адаптивная форма под каждый тип (binary показывает только критерий, threshold — числитель/знаменатель/пороги)
- **Визуальный редактор порогов** — без JSON, таблица строк: select оператора + input числа + input балла
- `quarterly_threshold`: 4 таба Q1/Q2/Q3/Q4, кнопка «Скопировать активный квартал во все» + confirm()
- `multi_binary`: список подпоказателей с описанием, кнопка «+ Добавить подпоказатель»
- `multi_threshold`: N подпоказателей, каждый со своим числитель/знаменатель/пороги
- Валидация всех полей с сообщениями об ошибках под каждым полем
- При смене типа — скролл к началу формы (formScrollRef)

### Admin-панель — финальное состояние

**Таб «Подчинённость»:**
- Режим «Список» — 91 строка, sticky-заголовок, бейджи ✅/⚠️, кнопка «Изменить»
- Режим «По подразделениям» — левая панель (верхний уровень, `normalizeUnit()`), правая часть с должностями
- Сохранение руководителя в таблицу `subordination` PostgreSQL (не в json-файл)
- После «Импорт из People» — баннер с должностями без карточек

**Таб «KPI-карточки»:**
- Левый сайдбар по верхнеуровневым подразделениям (normalizeUnit)
- Секция «⚠️ Без карточки»
- Wizard создания: Шаг 1 (название/pos_id/подразделение) + Шаг 2 (пустая/копия)
- Редактирование весов, стрелки сортировки, удаление показателя из карточки

**Таб «KPI-показатели»:**
- Sticky поиск + кнопка «+ Добавить показатель», sticky заголовок таблицы
- Счётчик «Все» = 124, неактивные показатели — opacity 0.5
- Конструктор всех 6 типов

**Общий хелпер:** `frontend/src/utils/admin.ts` — `normalizeUnit()`, `buildDeptMap()`, `sortedDeptKeys()`

## Этап 3 — Управление периодами (детали)

### API (`/api/periods/`)
- `POST /` — создаёт период со статусом `draft` (только admin)
- `GET /` — список с фильтрами `?status=` и `?year=`
- `POST /{id}/create-tasks?dry_run=true` — создаёт задачи в Redmine
- `POST /{id}/exceptions` / `GET /{id}/exceptions` — управление исключениями

## KPI Engine (шаги A–E)

### KpiMappingService (`backend/app/services/kpi_mapping_service.py`)
- 6 типов formula_type: `binary_auto`, `binary_manual`, `multi_binary`, `threshold`, `multi_threshold`, `quarterly_threshold`
- `get_kpi_structure(role_id)` → `KpiStructure { binary_auto[], binary_manual[], multi_binary[], numeric[] }`
- **Важно:** `employees.position_id` хранит числовой `pos_id` (`"71"`), не `role_id` (`"ЦТР_НАЧ_071"`)

### ThresholdParser (`backend/app/services/threshold_parser.py`)
- `parse_thresholds(str)` → `list[ThresholdRule]`
- `apply_threshold(value, rules)` → `float` (score 0–100)
- Поддерживает операторы: `>=`, `>`, `<=`, `<`, `=`
- 17 unit-тестов: `pytest backend/tests/test_threshold_parser.py`

### KpiEngineService (`backend/app/services/kpi_engine_service.py`)
- `process_submission(submission_id, db)` → `KpiEngineResult`
- Параллельный вызов AI через `asyncio.gather`
- Сохраняет в `submission.kpi_values` (JSONB) + `submission.ai_raw_summary`

### API Submissions
- `POST /my/{id}/generate-summary` → KpiEngineResult
- `GET /my/{id}/score` → ScoreResponse
- `PATCH /my/{id}` → SubmissionNumericUpdate
- `GET /my/{id}/kpi-structure` → KpiStructure
- `POST /my/{id}/submit` → отправка на проверку

### API Review
- `GET /{id}/pending-manual` → список binary_manual KPI
- `PATCH /{id}/binary-manual` → score 0|100
- Проверка subordination через `_get_effective_subordinate_ids` (читает из таблицы БД, fallback на json)

## Frontend — Dark Cyber дизайн-система

- `frontend/src/styles/cyber.css`
- Палитра: `--bg #06060f`, `--accent #00e5ff`, `--accent3 #00ff9d`, `--danger #ff3b5c`, `--warn #ffb800`
- Шрифты: Orbitron (цифры/заголовки), Exo 2 (текст)
- Компоненты: `.cyber-card`, `.progress-bar-wrap/.fill`, `.badge-*`, `.loader-ring`
- Sticky-шапки: `position: sticky; top: 64px; z-index: 30; background: var(--bg)`
- Скроллящиеся колонки: `display: flex; height: calc(100vh - 200px); overflow: hidden` + внутренние `overflow-y: auto`
- Модалки: overlay `position: fixed; inset: 0; padding-top: 64px; z-index: 100`, контент `overflow: hidden; display: flex; flex-direction: column; max-height: 88vh`

## AI-провайдеры

| Провайдер | Статус | Ключ |
|---|---|---|
| YandexGPT (PRIMARY) | ✅ Работает | aistudio.yandex.ru → API Keys |
| GigaChat (FALLBACK) | ❌ 401, устарел | developers.sber.ru |

**Важно:** YANDEX_API_KEY получать ТОЛЬКО через aistudio.yandex.ru → API Keys.

## Переменные окружения

```env
REDMINE_URL=https://kkp.rm.mosreg.ru
REDMINE_API_KEY=...
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=kpi_db
POSTGRES_USER=kpi_user
POSTGRES_PASSWORD=...
JWT_SECRET_KEY=...
YANDEX_API_KEY=...
YANDEX_FOLDER_ID=b1gjo5d34h6tr4ijadq6
GIGACHAT_API_KEY=...    # нужно обновить
TELEGRAM_BOT_TOKEN=...
FINANCE_TELEGRAM_IDS=...
FRONTEND_URL=...
BACKEND_URL=...
```

## Матрица подчинённости (верхний уровень)

```
РУК_ПЕРЗ_001 → ПРА_НАЧ_032, КЗА_НАЧ_042
РУК_ЗАМД_002 → ЗПД_НАЧ_052, ЗПР_НАЧ_061
РУК_ЗАМД_003 → ЕАС_НАЧ_019
РУК_ЗАМД_004 → ЦТР_НАЧ_071, ААД_НАЧ_081
ОРГ_НАЧ_005  → подчиняется директору (вне бота)
```

Синхронизация: вручную через People export из Redmine → кнопка «Импорт из People» в admin.
Хранится в таблице `subordination` PostgreSQL. Fallback на `reference/subordination.json`.

## Миграции Alembic (последние)

```
...          — шаги A–H (исторические)
j3k4l5m6n7o8 — таблица subordination
k4l5m6n7o8p9 — sub_type + order в kpi_criteria; formula_type += 'multi_binary'
```

## Известные баги

| # | Описание | Модуль | Статус |
|---|---|---|---|
| 1 | Прогресс-бар в черновике = 100% | Dashboard | ❌ Открыт |
| 2 | GigaChat fallback 401 (ключ устарел) | AI | ❌ Открыт |

## Открытые задачи (по приоритету)

### 🔴 Критичные
1. **Шаг K** — числовые KPI: ввод числитель/знаменатель в форме сотрудника, расчёт %, применение порогов
2. Telegram-уведомления — проверить что доходят
3. Заполнить `numerator_label` / `denominator_label` у threshold показателей в БД

### 🟡 Средние
4. Workflow утверждения показателей (draft→review→active) в UI
5. Поиск в KPI-показателях — проверить после всех фиксов
6. Удалить тестовые показатели (пометить `inactive`)
7. Тестирование на реальных сотрудниках (создать период)
8. Роль HR — добавить в систему
9. Обновить GigaChat ключ

### 🟢 Низкие
10. Activity types → KPI маппинг (шаг I)
11. Уведомления при изменении карточки KPI
12. Дубль «земельно-имущественных» в панели (грязные данные в Redmine)

## Соглашения по разработке

1. **Всегда** фиксировать BL перед кодом
2. Задачи для Claude Code — отдельные .md файлы в /outputs
3. Dark Cyber дизайн везде (cyber.css, Orbitron + Exo 2)
4. Изменения KPI-карточек вступают со **следующего** периода
5. `is_common` показатели меняет только HR/admin
6. Источник трудозатрат для AI — поле `comments` в time_entries Redmine
7. Один трекер KPI_ОТЧЁТ (id=279) для всех задач
8. Должности/подразделения — только через Redmine + Импорт из People
9. Новые показатели создают: начальники управлений + заместители директора
10. `normalizeUnit()` для группировки подразделений — `frontend/src/utils/admin.ts`

## Деплой на Amvera

```bash
# Применить миграции
docker compose exec backend alembic upgrade head

# Первая синхронизация
curl -X POST https://your-app.amvera.io/api/sync/run \
  -H "Authorization: Bearer <admin_token>"
```

- `reference/` монтируется read-only — файлы должны быть в репо
- Первый вход: войти через Redmine-учётку, выставить роль `admin` вручную в таблице `users`
- Telegram-бот работает в polling-режиме
