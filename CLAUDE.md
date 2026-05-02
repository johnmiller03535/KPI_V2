# CLAUDE.md — KPI Портал ГКУ МО «РЦТ»

> Обновляется в конце каждой сессии. Последнее обновление: 2026-05-02 (шаг J: редизайн admin-панели — структура, KPI-карточки, подчинённость)

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

## Структура проекта

```
kpi-portal/
├── backend/          ← FastAPI
│   ├── app/
│   │   ├── api/      ← роутеры
│   │   ├── models/   ← SQLAlchemy модели
│   │   ├── schemas/  ← Pydantic схемы
│   │   ├── services/ ← бизнес-логика
│   │   └── core/     ← auth, dependencies
│   └── alembic/      ← миграции
├── frontend/         ← Next.js 14
│   └── src/app/      ← App Router
├── nginx/            ← reverse proxy
├── docs/             ← BL-документы
│   ├── BL_subordination.md
│   ├── BL_kpi_cards.md
│   ├── BL_kpi_constructor.md
│   ├── BL_ai_assessment.md
│   ├── BL_numeric_kpi.md
│   └── BL_admin_structure.md   ← новый (2026-05-02)
├── reference/        ← справочные файлы (не в коде)
│   ├── KPI_Mapping.xlsx
│   ├── subordination.json
│   └── ...
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
| J | Редизайн admin: дерево подчинённости, сайдбар карточек, wizard, «+ Показатель» | ✅ |

## Ключевые решения (зафиксированные)

- Redmine — единственный источник истины для пользователей, задач и **структуры организации**
- Должности и подразделения создаются только в Redmine, портал обогащает (KPI-карточки, подчинённость)
- Авторизация: логин/пароль Redmine → JWT (access 15min, refresh 7d)
- БД — только для состояния приложения, кэша и аудита
- PDF через WeasyPrint (HTML-шаблон → PDF, печатается на любой ОС)
- Уведомления только через Telegram
- Синхронизация с Redmine — еженедельно (APScheduler)
- Изменения KPI-карточек вступают в силу со **следующего** периода

## KPI-конструктор (шаг G, апрель–май 2026)

### БД — 5 таблиц конструктора
- `kpi_indicators` — библиотека показателей (126 шт, 3 общих is_common)
- `kpi_criteria` — критерии и формулы показателей (189 шт)
- `kpi_role_cards` — карточки должностей (91 шт)
- `kpi_role_card_indicators` — показатели в карточке (261 привязка)
- `kpi_change_requests` — запросы на изменение

### Импорт xlsx
- Источник: `reference/KPI_Mapping.xlsx`
- Результат: 124 показателя (3 общих + 121 обычный), 189 критериев, 91 карточка, 261 привязка
- Ровно 3 общих показателя (is_common=true): исполнительская дисциплина, трудовой распорядок, охрана труда
- **Важно:** счётчик «124» в сайдбаре KPI-показателей — корректен. Число 126 было ошибкой документации.
- Скрипт: `backend/app/services/kpi_import_service.py`

### API конструктора (backend/app/api/admin.py)
- `GET /api/admin/indicators/` — список показателей с фильтрами
- `POST /api/admin/indicators/` — создать показатель
- `PATCH /api/admin/indicators/{id}` — редактировать
- `GET /api/admin/kpi-cards/` — список карточек
- `POST /api/admin/kpi-cards/` — создать карточку (поддерживает `copy_from_card_id`)
- `GET /api/admin/kpi-cards/positions-without-cards` — должности без карточки
- `GET /api/admin/subordination` — матрица подчинения (включает `has_kpi_card: bool`)

## Шаг J — Редизайн admin-панели (2026-05-02)

### ИЗМЕНЕНИЕ 1 — Таб «Подчинённость»: вид «Дерево»
- Переключатель [Список] / [Дерево] рядом с кнопками «Обновить» / «Импорт из People»
- Дерево: иерархия по подразделениям, отступы по уровням, бейджи статуса карточки
- Бейдж `✅ карточка` (зелёный) / `⚠️ нет карточки` (жёлтый, кликабельный → KPI-карточки)
- После импорта: баннер «Найдено N должностей без карточки: [список]»
- Backend: `GET /api/admin/subordination` расширен полем `has_kpi_card`

### ИЗМЕНЕНИЕ 2 — Таб «KPI-карточки»: сайдбар по подразделениям
- Убран одинокий дропдаун, заменён двухколоночным layout (как KPI-показатели)
- Левый сайдбар: подразделения со счётчиками + пункт «⚠️ Без карточки»
- Правая часть: карточки подразделения, кнопки «Открыть →» / «Создать карточку →»
- Backend: `GET /api/admin/kpi-cards/positions-without-cards`

### ИЗМЕНЕНИЕ 3 — Wizard «Создать карточку»
- Кнопка `[+ Создать карточку]` в правом верхнем углу таба
- Шаг 1: название, подразделение, код должности
- Шаг 2: пустая карточка ИЛИ скопировать с существующей
- После создания — карточка сразу открывается в режиме редактирования
- Backend: `POST /api/admin/kpi-cards/` с поддержкой `copy_from_card_id`

### ИЗМЕНЕНИЕ 4 — Таб «KPI-показатели»: кнопка «+ Добавить показатель»
- Кнопка рядом со строкой поиска
- Форма адаптируется под тип (binary показывает только критерий, threshold — числитель/знаменатель/пороги)
- Счётчик «Все» показывает 124 — это корректное число (столько уникальных показателей в xlsx); неактивные показываются приглушённым цветом

### Новый BL-документ
- `docs/BL_admin_structure.md` — принципы управления структурой, жизненный цикл при изменениях, правила карточек и подчинённости

## AI-провайдеры (актуальная конфигурация)

| Провайдер | Статус | Ключ |
|---|---|---|
| YandexGPT (PRIMARY) | ✅ Работает | Из aistudio.yandex.ru |
| GigaChat (FALLBACK) | ❌ 401, ключ устарел | Обновить на developers.sber.ru |
| Заглушка | ✅ Работает | Автоматически |

**Важно:** YANDEX_API_KEY получать ТОЛЬКО через aistudio.yandex.ru → API Keys.

## Переменные окружения (актуальные)

```env
REDMINE_URL=https://kkp.rm.mosreg.ru
REDMINE_API_KEY=...
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=kpi_db
POSTGRES_USER=kpi_user
POSTGRES_PASSWORD=...
JWT_SECRET_KEY=...
YANDEX_API_KEY=...        # из aistudio.yandex.ru
YANDEX_FOLDER_ID=b1gjo5d34h6tr4ijadq6
GIGACHAT_API_KEY=...      # из developers.sber.ru (нужно обновить)
TELEGRAM_BOT_TOKEN=...
FINANCE_TELEGRAM_IDS=...
FRONTEND_URL=...
BACKEND_URL=...
```

## Известные баги

| # | Описание | Модуль | Статус |
|---|---|---|---|
| 1 | Прогресс-бар в черновике = 100% | Dashboard | ❌ Открыт |
| 2 | GigaChat fallback 401 (ключ устарел) | AI | ❌ Открыт |

## Открытые задачи (по приоритету)

### 🔴 Критичные
1. Числовые KPI — реализовать ввод числитель/знаменатель в форме сотрудника
2. Редактор показателей — заполнить `numerator_label`, `denominator_label` для threshold-типов
3. Telegram-уведомления — проверить что доходят

### 🟡 Средние
4. Тестирование на реальных сотрудниках (создать период для всех)
5. Роль HR — добавить в систему
6. Инструкция для сотрудников по ведению трудозатрат в Redmine
7. Обновить GigaChat ключ (fallback)

### 🟢 Низкие
8. Activity types → KPI маппинг (шаг I)
9. Уведомления при изменении карточки KPI

## Матрица подчинённости (верхний уровень)

```
РУК_ПЕРЗ_001 → ПРА_НАЧ_032, КЗА_НАЧ_042
РУК_ЗАМД_002 → ЗПД_НАЧ_052, ЗПР_НАЧ_061
РУК_ЗАМД_003 → ЕАС_НАЧ_019
РУК_ЗАМД_004 → ЦТР_НАЧ_071, ААД_НАЧ_081
ОРГ_НАЧ_005  → подчиняется директору (вне бота)
```

## Соглашения по разработке

1. **Всегда** фиксировать BL перед кодом
2. Задачи для Claude Code — отдельные .md файлы в /outputs
3. Dark Cyber дизайн везде (cyber.css, Orbitron + Exo 2)
4. Изменения KPI-карточек вступают со **следующего** периода
5. `is_common` показатели меняет только HR/admin
6. Источник трудозатрат для AI — поле `comments` в time_entries Redmine
7. Один трекер KPI_ОТЧЁТ (id=279) для всех задач
8. Должности/подразделения — только через Redmine + Импорт из People

## Этап 3 — Управление периодами (детали реализации)

### Модели
- `Period` — таблица `periods`: тип (monthly/quarterly/yearly), даты, статус (draft→active→review→closed)
- `PeriodException` — таблица `period_exceptions`: исключения сотрудников

### API (`/api/periods/`)
- `POST /` — создаёт период со статусом `draft` (только admin)
- `GET /` — список с фильтрами `?status=` и `?year=`
- `POST /{id}/create-tasks?dry_run=true` — создаёт задачи в Redmine
- `POST /{id}/exceptions` / `GET /{id}/exceptions` — управление исключениями

## Доработка — KPI Engine (шаги A–E)

### KpiMappingService (backend/app/services/kpi_mapping_service.py)
- 5 типов formula_type: `binary_auto`, `binary_manual`, `threshold`, `multi_threshold`, `quarterly_threshold`
- `get_kpi_structure(role_id)` → `KpiStructure { binary_auto[], binary_manual[], numeric[] }`
- **Важно:** `employees.position_id` хранит числовой `pos_id` (`"71"`), не `role_id` (`"ЦТР_НАЧ_071"`)

### ThresholdParser (backend/app/services/threshold_parser.py)
- `parse_thresholds(str)` → `list[ThresholdRule]`
- `apply_threshold(value, rules)` → `float` (score 0–100)
- 17 unit-тестов: `pytest backend/tests/test_threshold_parser.py`

### KpiEngineService (backend/app/services/kpi_engine_service.py)
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
- Проверка subordination через `_get_effective_subordinate_ids`

### Frontend — Dark Cyber дизайн-система
- `frontend/src/styles/cyber.css`
- Палитра: `--bg #06060f`, `--accent #00e5ff`, `--accent3 #00ff9d`, `--danger #ff3b5c`, `--warn #ffb800`
- Шрифты: Orbitron (цифры/заголовки), Exo 2 (текст)
- Компоненты: `.cyber-card`, `.progress-bar-wrap/.fill`, `.badge-*`, `.loader-ring`

## Деплой на Amvera

```bash
# Применить все миграции
docker compose exec backend alembic upgrade head

# Первая синхронизация сотрудников
curl -X POST https://your-app.amvera.io/api/sync/run \
  -H "Authorization: Bearer <admin_token>"
```

- `reference/` монтируется как read-only — `KPI_Mapping.xlsx` и `subordination.json` должны быть в репо
- Первый вход: войти через Redmine-учётку, выставить роль `admin` вручную в таблице `users`
- Telegram-бот работает в polling-режиме
