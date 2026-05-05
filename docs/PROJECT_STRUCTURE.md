# PROJECT_STRUCTURE.md — Структура проекта KPI Портал

> Дата: 2026-05-05 | Для передачи в новый чат Claude

---

## Корень проекта

```
KPI_V2/
```

| Файл / Папка | Описание |
|---|---|
| `CLAUDE.md` | **Главный контекст** — полное описание проекта для Claude: стек, этапы, BL-решения, открытые задачи. Читать первым |
| `CONTEXT_for_new_chat.md` | Сжатый контекст для передачи в новый чат (статус, текущая задача, ключевые факты) |
| `TESTING_AND_ROADMAP.md` | Роадмап по модулям: статус каждой функции, план тестирования шага K, список исправленных багов |
| `ROADMAP.md` | Устаревший роадмап (заменён TESTING_AND_ROADMAP.md) |
| `CLAUDE_CODE_TASKS.md` | Устаревший файл задач |
| `docker-compose.yml` | Dev-окружение: postgres, backend, frontend, nginx |
| `docker-compose.prod.yml` | Prod-окружение для Amvera |
| `amvera.yml` | Конфигурация деплоя на Amvera |
| `.env` | Переменные окружения (не в репо у прода) |
| `.env.example` | Шаблон переменных окружения |
| `.gitignore` | Игнорируемые файлы |
| `backup_before_cleanup_*.sql` | Резервные копии БД до аудита 2026-05-04 (два пустых + один с данными) |

---

## backend/

FastAPI-приложение (Python 3.12). Запускается в контейнере `kpi_v2-backend-1`.

| Файл | Описание |
|---|---|
| `Dockerfile` | Dev-образ backend |
| `Dockerfile.prod` | Prod-образ backend |
| `requirements.txt` | Python-зависимости |
| `alembic.ini` | Конфигурация Alembic (строка подключения к БД) |

### backend/app/

| Файл | Описание |
|---|---|
| `main.py` | Точка входа FastAPI: регистрация роутеров, CORS, startup/shutdown события, запуск бота и планировщика |
| `config.py` | Pydantic-настройки из `.env`: URL Redmine, ключи AI, параметры БД, Telegram-токен |
| `database.py` | AsyncEngine + AsyncSession + `get_db` dependency |
| `scheduler.py` | APScheduler: еженедельная синхронизация с Redmine, напоминания сотрудникам |

### backend/app/api/ — HTTP-роутеры

| Файл | Маршрут | Описание |
|---|---|---|
| `auth.py` | `/api/auth/` | Вход через Redmine API, выдача JWT access+refresh, `/me` |
| `admin.py` | `/api/admin/` | Управление KPI-карточками должностей: CRUD, wizard создания, sync-common, subordination, импорт People |
| `kpi_constructor.py` | `/api/kpi/` | Конструктор показателей: CRUD индикаторов и критериев, управление весами в карточке, approve |
| `kpi_submissions.py` | `/api/my/` | KPI-форма сотрудника: создание submission, AI-генерация, отправка на проверку |
| `review.py` | `/api/review/` | Проверка отчётов руководителем: pending-manual, binary-manual оценка, утверждение/отклонение |
| `periods.py` | `/api/periods/` | Управление периодами: CRUD, создание задач в Redmine, dry-run, исключения |
| `employees.py` | `/api/employees/` | Список сотрудников, поиск по pos_id |
| `finance.py` | `/api/finance/` | Финансовый дашборд: утверждённые отчёты с баллами |
| `reports.py` | `/api/reports/` | Генерация PDF-отчётов через WeasyPrint |
| `sync.py` | `/api/sync/` | Ручной запуск синхронизации с Redmine |
| `notifications.py` | `/api/notifications/` | Управление уведомлениями |
| `health.py` | `/api/health` | Health-check эндпоинт |

### backend/app/models/ — SQLAlchemy модели (таблицы БД)

| Файл | Таблица(ы) | Описание |
|---|---|---|
| `user.py` | `users` | Пользователи: роль (employee/manager/admin/finance), pos_id, Telegram chat_id |
| `employee.py` | `employees` | Сотрудники из Redmine: имя, должность, подразделение, position_id |
| `period.py` | `periods` | Отчётные периоды: даты, статус (draft/active/closed), redmine_version_id |
| `period_exception.py` | `period_exceptions` | Исключения из периода (сотрудники которых не оценивают) |
| `kpi_submission.py` | `kpi_submissions` | Отчёты сотрудников: JSONB kpi_values, ai_raw_summary, статус |
| `kpi_constructor.py` | `kpi_indicators`, `kpi_criteria`, `kpi_role_cards`, `kpi_role_card_indicators`, `kpi_change_requests` | Всё для конструктора KPI: показатели (7 типов), критерии/подпоказатели, карточки должностей, привязки с весами |
| `subordination.py` | `subordination` | Матрица подчинённости: pos_id → manager_pos_id |
| `notification.py` | `notifications` | Telegram-уведомления: тип, статус отправки |
| `audit_log.py` | `audit_log` | Лог изменений в системе |
| `sync_log.py` | `sync_log` | Лог синхронизаций с Redmine |
| `deputy.py` | `deputy_assignments` | Временные замещения руководителей |

### backend/app/schemas/ — Pydantic схемы (валидация запросов/ответов)

| Файл | Описание |
|---|---|
| `auth.py` | LoginRequest, TokenResponse, UserMe |
| `kpi_constructor.py` | IndicatorCreate/Update/Response, CriterionCreate, CardResponse, CardIndicatorUpdate |
| `kpi_submission.py` | SubmissionCreate, SubmissionResponse, KpiValueItem |
| `kpi.py` | KpiStructure, KpiEngineResult, ScoreResponse |
| `period.py` | PeriodCreate, PeriodResponse, PeriodExceptionCreate |
| `review.py` | ReviewSummary, BinaryManualUpdate, ApproveRequest |

### backend/app/services/ — Бизнес-логика

| Файл | Описание |
|---|---|
| `ai_service.py` | Запросы к YandexGPT (primary) и GigaChat (fallback). Генерирует AI-оценку binary_auto показателей по саммари трудозатрат |
| `kpi_engine_service.py` | Оркестрация обработки submission: параллельный вызов AI через asyncio.gather, сохранение kpi_values |
| `kpi_mapping_service.py` | `get_kpi_structure(role_id)` → KpiStructure. Загружает показатели из карточки должности, группирует по типам |
| `threshold_parser.py` | Парсинг и применение правил порогов. `parse_thresholds(str)` + `apply_threshold(value, rules)`. 17 unit-тестов |
| `kpi_import_service.py` | Импорт показателей из xlsx-файла (KPI_Mapping.xlsx) в БД |
| `people_import_service.py` | Импорт структуры должностей из People export Redmine → таблица `subordination` |
| `subordination_service.py` | Работа с матрицей подчинённости: `get_subordinates()`, fallback на `reference/subordination.json` |
| `period_service.py` | Создание задач в Redmine для отчётного периода |
| `sync_service.py` | Синхронизация пользователей/сотрудников из Redmine API |
| `notification_service.py` | Отправка Telegram-уведомлений через бота |
| `reminder_service.py` | Рассылка напоминаний сотрудникам о незаполненных отчётах |
| `report_service.py` | Генерация PDF-отчётов через WeasyPrint, прикрепление к задаче в Redmine |

### backend/app/core/ — Инфраструктура

| Файл | Описание |
|---|---|
| `deps.py` | FastAPI dependencies: `get_current_user`, проверка ролей (require_admin, require_manager) |
| `security.py` | JWT: создание и верификация access/refresh токенов (HS256, 15min/7d) |
| `redmine.py` | Обёртка над Redmine API: получение time_entries, users, issues, прикрепление файлов |

### backend/app/bot/ — Telegram-бот

| Файл | Описание |
|---|---|
| `bot.py` | Инициализация aiogram Bot + Dispatcher |
| `handlers.py` | Обработчики команд: `/start`, уведомления руководителям о новых отчётах на проверку |
| `keyboards.py` | Inline-клавиатуры Telegram |
| `runner.py` | Запуск polling в отдельном asyncio-task |

### backend/app/templates/

| Файл | Описание |
|---|---|
| `kpi_report.html` | HTML-шаблон для генерации PDF-отчёта через WeasyPrint. Таблица KPI с баллами |

### backend/alembic/ — Миграции БД

| Файл | Описание |
|---|---|
| `env.py` | Конфигурация Alembic: подключение к БД, импорт моделей |
| `script.py.mako` | Шаблон нового файла миграции |

**Миграции (хронологически):**

| Ревизия | Содержание |
|---|---|
| `a1b2c3d4e5f6` | Таблицы employees, sync_log |
| `b59e2a9d5e0c` | Таблицы users, audit_log |
| `c3d4e5f6a7b8` | Таблицы periods, period_exceptions |
| `d5e6f7a8b9c0` | Таблица kpi_submissions |
| `e6f7a8b9c0d1` | Таблица deputy_assignments |
| `f7a8b9c0d1e2` | Таблица notifications |
| `g8h9i0j1k2l3` | Поля ai_raw_summary в submissions |
| `h1i2j3k4l5m6` | Таблицы KPI-конструктора (kpi_indicators, kpi_criteria, kpi_role_cards, ...) |
| `i2j3k4l5m6n7` | Поля unit_name, indicator_group в kpi_indicators |
| `j3k4l5m6n7o8` | Таблица subordination |
| `k4l5m6n7o8p9` | sub_type + order в kpi_criteria; тип multi_binary |
| `l5m6n7o8p9q0` | Тип absolute_threshold в enum, поля value_label, is_quarterly в kpi_criteria |
| `m6n7o8p9q0r1` | Поле formula_desc в kpi_criteria |
| `n7o8p9q0r1s2` | Поле unit_name в kpi_indicators |
| `o8p9q0r1s2t3` | Поле default_weight в kpi_indicators |

### backend/tests/

| Файл | Описание |
|---|---|
| `test_threshold_parser.py` | 17 unit-тестов для ThresholdParser: операторы >=, >, <=, <, =, граничные случаи |

### backend/reference/ → symlink или копия `reference/`

---

## frontend/

Next.js 14 (App Router, TypeScript). Dark Cyber дизайн-система. Порт 3000.

| Файл | Описание |
|---|---|
| `Dockerfile` / `Dockerfile.prod` | Dev и prod образы frontend |
| `next.config.js` | Настройки Next.js: proxy к backend API (`/api` → `http://backend:8000`) |
| `package.json` | npm-зависимости |
| `tsconfig.tsbuildinfo` | Кэш TypeScript-компилятора (артефакт сборки) |

### frontend/src/app/ — Страницы (App Router)

| Файл / Папка | URL | Описание |
|---|---|---|
| `layout.tsx` | (global) | Корневой layout: подключение шрифтов (Orbitron, Exo 2), NavBar, глобальные стили |
| `page.tsx` | `/` | Главная страница: редирект на dashboard или login |
| `globals.css` | — | Базовые глобальные стили |
| `login/page.tsx` | `/login` | Форма входа: логин + пароль Redmine → JWT |
| `dashboard/page.tsx` | `/dashboard` | Дашборд сотрудника: список отчётных периодов, кнопка «Заполнить KPI» |
| `kpi/[submissionId]/page.tsx` | `/kpi/:id` | KPI-форма сотрудника: binary_auto (AI-саммари), binary_manual (текст), отправка на проверку |
| `review/page.tsx` | `/review` | Дашборд руководителя: список отчётов подчинённых на проверку |
| `review/[submissionId]/page.tsx` | `/review/:id` | Форма проверки: AI-оценка, ручная оценка binary_manual, утверждение |
| `admin/page.tsx` | `/admin` | **Главная admin-панель** (~3000 строк): 3 таба — Подчинённость, KPI-карточки, KPI-показатели с полным конструктором |
| `admin/periods/page.tsx` | `/admin/periods` | Управление периодами: создание, dry-run, активация |
| `admin/notifications/page.tsx` | `/admin/notifications` | Просмотр лога уведомлений |
| `finance/page.tsx` | `/finance` | Финансовый дашборд: утверждённые отчёты с итоговыми баллами |

### frontend/src/components/ — Переиспользуемые компоненты

| Файл | Описание |
|---|---|
| `NavBar.tsx` | Верхняя навигация: логотип, ссылки по роли, кнопка «Выйти» |
| `kpi/KpiCard.tsx` | Карточка одного KPI-показателя в форме сотрудника |
| `kpi/NumericInput.tsx` | Поле ввода числового KPI (числитель + знаменатель) — заготовка для шага K |
| `kpi/ScoreHeader.tsx` | Шапка с итоговым баллом сотрудника |
| `kpi/SectionTitle.tsx` | Заголовок секции внутри KPI-формы |
| `kpi/StatusBadge.tsx` | Бейдж статуса (draft / submitted / approved / rejected) |

### frontend/src/lib/ — Утилиты

| Файл | Описание |
|---|---|
| `api.ts` | Axios-инстанс с базовым URL `/api`, интерцептор для JWT-токена и авто-рефреш при 401 |
| `kpiScore.ts` | Клиентский расчёт итогового балла: сумма (балл × вес) по всем показателям |

### frontend/src/styles/

| Файл | Описание |
|---|---|
| `cyber.css` | **Dark Cyber дизайн-система**: палитра (`--bg #06060f`, `--accent #00e5ff`, `--accent3 #00ff9d`, `--danger`, `--warn`), компоненты `.cyber-card`, `.badge-*`, `.progress-bar-*`, `.loader-ring`, правила для sticky-шапок и модалок |

### frontend/src/utils/

| Файл | Описание |
|---|---|
| `admin.ts` | `normalizeUnit(name)` — нормализация названий подразделений для группировки. `buildDeptMap(entries)` — построение словаря управление → должности. `sortedDeptKeys(map)` — сортировка ключей карты |

---

## docs/ — Документация

### Бизнес-логика (BL-документы)

| Файл | Описание |
|---|---|
| `BL_subordination.md` | Матрица подчинённости: структура, источник данных, алгоритм определения руководителя |
| `BL_ai_assessment.md` | AI-оценка binary_auto: флоу, промпт, провайдеры (YandexGPT / GigaChat fallback) |
| `BL_kpi_cards.md` | KPI-карточки должностей: структура, workflow, правила is_common |
| `BL_kpi_constructor.md` | Конструктор показателей: полное описание API и логики |
| `BL_indicator_types.md` | **7 типов KPI-показателей**: детальное описание каждого типа, хранение в БД, примеры порогов |
| `BL_admin_structure.md` | Структура admin-панели: табы, компоненты, хелперы |

> `BL_numeric_kpi.md` — **читать перед шагом K** (числовые KPI в форме сотрудника)

### Контекст для новых чатов

| Файл | Описание |
|---|---|
| `CONTEXT_for_new_chat.md` | Сжатый контекст для передачи в новый чат Claude (текущая задача, статус, TODO) |
| `PROJECT_STRUCTURE.md` | Этот файл — карта проекта |

### Отчёты

| Файл | Описание |
|---|---|
| `db_consistency_report.md` | Отчёт аудита БД 2026-05-04: показатели с нарушенной структурой подпоказателей |
| `kpi_audit_report.md` | Отчёт аудита данных: соответствие xlsx-данных актуальной методике |
| `redmine_api_research.json` | Результаты исследования Redmine API (структура ответов) |
| `redmine_people_api.json` | Результаты исследования People export API Redmine |
| `people_ГКУ_"РЦТ"2026-04-19.xlsx` | People export из Redmine (91 сотрудник, источник для subordination) |

### Чеклисты

| Файл | Описание |
|---|---|
| `CHECKLIST_admin_full.md` | Полный чеклист тестирования admin-панели |
| `CHECKLIST_admin_ui_redesign.md` | Чеклист для редизайна admin UI |
| `CHECKLIST_kpi_cards_review.md` | Чеклист проверки KPI-карточек |

### Архив

| Папка | Описание |
|---|---|
| `completed_tasks/2026-05-04/` | 49 выполненных TASK_*.md файлов из всех сессий |

---

## reference/ — Справочники (read-only, в репо)

| Файл | Описание |
|---|---|
| `KPI_Mapping.xlsx` | Исходный маппинг показателей из xlsx (использовался для импорта, сейчас данные чищены) |
| `subordination.json` | JSON-fallback матрицы подчинённости (используется если таблица PostgreSQL пуста) |
| `people_export.xlsx` | People export из Redmine (дубль, основной в docs/) |
| `managers.json` | Список руководителей (вспомогательный справочник) |
| `staff.json` | Список сотрудников (вспомогательный справочник) |
| `Методика оценки.docx` | Оригинальный документ методики KPI оценки ГКУ МО «РЦТ» |
| `Показатели.docx` | Оригинальный документ с описанием показателей |

---

## Состояние БД (kpi_portal) на 2026-05-05

| Таблица | Записей | Примечание |
|---|---|---|
| `kpi_indicators` | 3 | Только is_common=true, status=active. Чистый старт после аудита |
| `kpi_criteria` | 3 | По одному на каждый общий показатель |
| `kpi_role_cards` | 0 | Все 91 должность — «Без карточки» |
| `kpi_role_card_indicators` | 0 | — |
| `subordination` | 91 | Полная матрица подчинённости |

---

## Важные технические факты

- БД называется `kpi_portal` (не `kpi_db`!)
- `employees.position_id` — числовой `pos_id` (`"71"`), не `role_id` (`"ЦТР_НАЧ_071"`)
- Все TODO-ограничения аудита помечены `# TODO: АУДИТ 2026-05-04` — вернуть после наполнения данных
- `normalizeUnit()` — единая точка нормализации названий подразделений
- Docker-контейнеры: `kpi_v2-backend-1`, `kpi_v2-postgres-1`, `kpi_v2-frontend-1`
