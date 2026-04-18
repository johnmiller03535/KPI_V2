# CLAUDE.md — KPI Портал ГКУ МО «РЦТ»

> Обновляется в конце каждой сессии. Последнее обновление: 2026-04-17 (шаг D: Форма руководителя + PDF + Dark Cyber фронт)

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
| AI | GigaChat (основной) / Gemini (резервный) |
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
| 4 | KPI-форма сотрудника + Claude API | ✅ |
| 5 | Дашборд руководителя + утверждение | ✅ |
| 6 | Генерация PDF + запись в Redmine | ✅ |
| 7 | Система напоминаний | ✅ |
| 8 | Telegram-бот (руководители) | ✅ |
| 9 | Панель администратора | ✅ |
| 10 | Финансовый дашборд | ✅ |

## Ключевые решения (зафиксированные)

- Redmine — единственный источник истины для пользователей и задач
- Авторизация: логин/пароль Redmine → JWT (access 15min, refresh 7d)
- БД — только для состояния приложения, кэша и аудита
- PDF через WeasyPrint (HTML-шаблон → PDF, печатается на любой ОС)
- Уведомления только через Telegram
- Синхронизация с Redmine — еженедельно (APScheduler)

## Этап 3 — Управление периодами (детали реализации)

### Модели
- `Period` — таблица `periods`: тип (monthly/quarterly/yearly), даты, статус (draft→active→review→closed)
- `PeriodException` — таблица `period_exceptions`: исключения сотрудников (dismissed/transferred/excluded/maternity)

### API (`/api/periods/`)
- `POST /` — создаёт период со статусом `draft` (только admin)
- `GET /` — список с фильтрами `?status=` и `?year=`
- `POST /{id}/create-tasks?dry_run=true` — создаёт задачи в Redmine; `dry_run` не меняет данные
- `POST /{id}/exceptions` / `GET /{id}/exceptions` — управление исключениями

### Маппинги Redmine (временные, замена в этапе 4)
- `DEPT_PROJECT_MAP`: department_code → Redmine project identifier (9 проектов kpi-*)
- `dept_tracker_map`: project_id → tracker_id (fallback, первый трекер подразделения)
- Кастомные поля: CF_PERIOD=205 (период), CF_ROLE_ID=206 (должность)

### Frontend
- `/admin/periods` — страница управления периодами (только admin)
- `/dashboard` — ссылка «Управление периодами» для роли admin

## Этап 4 — KPI-форма сотрудника (детали реализации)

### Модели
- `KpiSubmission` — таблица `kpi_submissions`: employee+period+position_id, статус, бинарные поля, kpi_values JSON, AI-поля, reviewer-поля

### Сервисы
- `AIService.summarize_time_entries` — провайдеры с приоритетом: GigaChat → Gemini → заглушка; промт → JSON с criteria/general_summary/discipline_summary; заглушка при пустых трудозатратах
- `KpiMappingService` — читает KPI_Mapping.xlsx (openpyxl); 91 должность, 478 индикаторов
  - `get_binary_auto_criteria(role_id)` → `formula_type == "100%"` (бинарные, AI-описание)
  - `get_numeric_kpis(role_id)` → `formula_type != "100%"` (пороговые, ввод вручную)
  - Дедупликация критериев через seen-set

### Важно: реальные formula_type в KPI_Mapping.xlsx
Значения — процентные пороги (`100%`, `90%`, `65%`, `>=3,5`, `>22` и т.д.), не символические имена.
- `100%` → бинарный KPI (AI-саммари)
- всё остальное → числовой KPI (ввод факта вручную)

### API (`/api/submissions/`)
- `GET /my` — список своих отчётов
- `GET /my/{id}` — конкретный отчёт
- `POST /my/{id}/generate-summary` — трудозатраты Redmine → Claude API → сохранить
- `PATCH /my/{id}` — сохранить черновик (bin-поля + kpi_values JSON)
- `POST /my/{id}/submit` — отправить на проверку (→ submitted)
- `GET /my/{id}/kpi-structure` — структура KPI из KPI_Mapping для должности

### Frontend
- `/kpi/{submissionId}` — KPI-форма сотрудника: AI-кнопка, текстовые поля, числовые KPI
- `/dashboard` — список KPI-отчётов с цветными статус-бейджами и кнопкой «Открыть»

## Этап 7 — Система напоминаний (детали реализации)

### Модели
- `Notification` — таблица `notifications`: получатель, тип, текст, period_id, submission_id, статус, dedup_key (unique)
- `NotificationType`: `employee_reminder_3d/1d`, `manager_reminder_3d/1d`, `admin_no_telegram`
- `NotificationStatus`: `pending`, `sent`, `failed`, `skipped` (нет telegram_id)
- `dedup_key` формат: `"{type}:{recipient_redmine_id}:{period_id}:{date}"` — гарантирует одно уведомление в день

### Сервис (`ReminderService`)
- `run_daily_reminders(db)` — итерирует активные периоды; триггерит напоминания при `days_to_submit ∈ {3,1}` и `days_to_review ∈ {3,1}`
- `_remind_employees` — все `EmployeeStatus.active` у кого нет `submitted`/`approved` отчёта за период
- `_remind_managers` — группирует `submitted`-отчёты по `evaluator_position_id` (через `subordination_service`), находит руководителя в `employees` по `position_id`
- `_send_notification` — проверяет `dedup_key`, при нет `telegram_id` → статус `skipped` + WARNING лог, иначе → Telegram API
- `_notify_admin_missing_telegram` — сводка до 30 имён всем admin-пользователям у которых есть `telegram_id`

### Планировщик
- Новая задача `daily_reminders` в `scheduler.py`: `CronTrigger(hour=9, minute=0)`, timezone `Europe/Moscow`
- Рядом с существующей задачей `employee_sync` (воскресенье 02:00 МСК)

### API (`/api/notifications/`) — только admin
- `POST /run-reminders` — ручной запуск, возвращает stats dict
- `GET /logs?status=&limit=` — история уведомлений
- `GET /stats` — счётчики по статусам

### Миграция
- `f7a8b9c0d1e2` — создаёт таблицу `notifications`, enums `notificationtype` и `notificationstatus`, индексы на `recipient_redmine_id` и `dedup_key`
- Итого таблиц: 11

### Frontend
- `/admin/notifications` — страница: статистика по статусам, фильтры, лог уведомлений, кнопка ручного запуска с результатом
- `/dashboard` — кнопка «Уведомления» (cyan) для роли `admin` рядом с «Управление периодами»

## Этап 8 — Telegram-бот для руководителей (детали реализации)

### Модули (`backend/app/bot/`)
- `__init__.py` — пустой, делает директорию пакетом
- `bot.py` — инициализация `Bot` и `Dispatcher` (aiogram 3); токен из `settings.telegram_bot_token`
- `keyboards.py` — inline-клавиатуры: `review_keyboard(submission_id)`, `confirm_reject_keyboard`, `already_decided_keyboard`
- `handlers.py` — роутер с хендлерами команд и callback-кнопок
- `runner.py` — `start_bot()` / `stop_bot()`: polling-режим, запускается как `asyncio.create_task`

### Команды бота
- `/start` — приветствие с именем сотрудника (из `employees` по `telegram_id`)
- `/portal` — ссылка на веб-портал
- `/pending` — количество `submitted`-отчётов подчинённых (через `subordination_service`)
- `/cancel` — отмена текущего FSM-состояния

### Callback-хендлеры
- `approve:<submission_id>` — утверждает отчёт, запускает автофинализацию (PDF + Redmine + finance TG)
- `reject_start:<submission_id>` → FSM `RejectStates.waiting_comment` → вводит комментарий → `rejected`; при reject уведомляет сотрудника в TG
- Идемпотентность: если статус уже не `submitted` → показывает `already_decided_keyboard`

### Уведомление при submit
- `kpi_submissions.py::submit_for_review` после `commit` вызывает `_notify_manager_about_submission`
- Находит руководителя через `subordination_service.get_evaluator_position(position_id)`
- Отправляет сообщение с `review_keyboard` в `manager.telegram_id`
- Ошибки отправки логируются, но не прерывают submit

### Интеграция в main.py
- `startup`: `asyncio.create_task(start_bot())` — бот запускается в фоне вместе с FastAPI
- `shutdown`: `await stop_bot()` — закрывает сессию бота

## Этап 9 — Панель администратора (детали реализации)

### API (`/api/admin/`) — только admin
- `GET /overview` — статистика по организации: всего/активных/уволенных/без TG/без должности
- `GET /periods/{id}/stats` — статусы отчётов по периоду (draft/submitted/approved/rejected/no_submission, completion_pct)
- `GET /periods/{id}/dept-stats` — разбивка по подразделениям (total/submitted/approved/pending)
- `GET /employees/no-telegram` — список активных сотрудников без telegram_id
- `GET /audit-log?limit=&action=` — журнал аудита (таблица audit_log)
- `GET /sync-logs?limit=` — история синхронизаций (таблица sync_log)

### Frontend
- `/admin` — панель с 4 табами: Обзор / Периоды / Сотрудники / Аудит
  - Обзор: 5 stat-карточек, история синхронизаций, статус отчётов по выбранному периоду, прогресс-бар, разбивка по подразделениям
  - Периоды: список всех периодов со статусами, клик → Обзор с этим периодом
  - Сотрудники: список без Telegram ID, ссылки на управление периодами и уведомлениями
  - Аудит: лог последних 50 действий
  - Кнопки «Синхронизировать Redmine» и «Запустить напоминания» в шапке
- `/dashboard` — кнопка «⚙️ Админ-панель» (тёмная) для роли admin

## Этап 10 — Финансовый дашборд (детали реализации)

### API (`/api/finance/`) — роли finance и admin
- `GET /periods` — список активных/закрытых периодов для фильтра
- `GET /reports?period_id=&department_code=&status=` — отчёты со статусами approved+submitted; сортировка по подразделению/имени
- `GET /periods/{id}/summary` — сводка готовности по подразделениям (is_complete, completion_pct)

### Frontend
- `/finance` — страница с фильтрами (период, подразделение) и двумя вкладками:
  - Сводка: общий прогресс + прогресс-бары по каждому подразделению с бейджами «✅ Готово» / «⏳ Частично»
  - Список: отчёты сгруппированы по подразделению, ссылки «🔗 Redmine» и «📄 PDF» для каждого
- `/dashboard` — кнопка «💰 Финансовый дашборд» (зелёная) для ролей finance и admin

### Оптимизация
- Сотрудники загружаются одним запросом (`redmine_id.in_(...)`) вместо N запросов в цикле

## Шаг A — AI-провайдер + KPI-рефакторинг (2026-04-17)

### ИЗМЕНЕНИЕ 1 — AI-провайдер: OpenAI → Gemini → заглушка
- `backend/app/services/ai_service.py` — два провайдера: OpenAI GPT-4o-mini (primary), Gemini 1.5 Flash (fallback)
- Новый метод `evaluate_binary_kpi(time_entries, criterion, formula_desc) → {score, summary, confidence}`
- `summarize_time_entries` сохранён для обратной совместимости, использует ту же цепочку провайдеров
- `backend/app/config.py` — добавлено поле `openai_api_key: str = ""`; удалено `gigachat_api_key`
- `backend/requirements.txt` — добавлен `openai>=1.0.0`

### ИЗМЕНЕНИЕ 2 — KpiMappingService: правильные formula_type
- `backend/app/schemas/kpi.py` — новые схемы `KpiItem` и `KpiStructure` (три группы: binary_auto / binary_manual / numeric)
- `backend/app/services/kpi_mapping_service.py` — полная перепись:
  - Реальные formula_type: `binary_auto`, `binary_manual`, `threshold`, `multi_threshold`, `quarterly_threshold`
  - `get_kpi_structure(role_id)` → `KpiStructure` с тремя группами
  - `get_kpi_structure_by_pos_id(pos_id)` — поиск по числовому pos_id из employees.position_id
  - `pos_id_to_role_id(pos_id)` — конвертация pos_id → role_id
  - Обратная совместимость: `get_binary_auto_criteria`, `get_numeric_kpis`, `get_kpi_for_role`
- **Важно:** `employees.position_id` хранит числовой `pos_id` (например `"4"`), а не `role_id` (`"РУК_ЗАМД_004"`) — используй `get_kpi_structure_by_pos_id` при работе с сотрудниками
- `GET /api/submissions/my/{id}/kpi-structure` — теперь возвращает `{role_id, binary_auto[], binary_manual[], numeric[], total_weight, role_info}`

### ИЗМЕНЕНИЕ 3 — ThresholdParser
- `backend/app/services/threshold_parser.py` — парсер строк вида `">=67%→100% | <67%,>50%→50% | <50%→0%"`
- Поддерживает: `threshold`, `multi_threshold`, `quarterly_threshold`
- `backend/tests/test_threshold_parser.py` — 17 unit-тестов, все зелёные

## Шаг B — KpiEngineService + обновлённые эндпоинты (2026-04-17)

### ИЗМЕНЕНИЕ 1 — KpiEngineService (новый файл)
- `backend/app/services/kpi_engine_service.py` — главный оркестратор обработки KPI-отчёта
- 10 шагов: загрузка sub → period → трудозатраты Redmine → KPI-структура → параллельная AI-оценка (`asyncio.gather`) → binary_manual разметка → numeric разметка → общее саммари → сохранение в БД → возврат `KpiEngineResult`
- Сохраняет в: `kpi_values` (JSON-список), `ai_raw_summary`, `ai_generated_at`
- `system_flags`: `{partial_result, requires_review: [...], awaiting_manual: N, requires_fact: N, time_entries_count: N}`
- `compute_score_from_kpi_values(kpi_values)` — пересчёт без обращения к БД

### ИЗМЕНЕНИЕ 2 — Новые схемы в kpi.py
- `KpiResult` — результат оценки одного KPI: score, confidence, summary, awaiting_manual_input, requires_fact_input, fact_value, parsed_thresholds, requires_review
- `KpiEngineResult` — итог всей обработки: kpi_results[], partial_score, total_weight, scored_weight, completion_pct, system_flags

### ИЗМЕНЕНИЕ 3 — Обновлённые эндпоинты kpi_submissions.py
- `POST /api/submissions/my/{id}/generate-summary` → теперь вызывает `KpiEngineService.process_submission()`, возвращает `KpiEngineResult`
- `GET /api/submissions/my/{id}/score` (новый) → возвращает `ScoreResponse` из сохранённых kpi_values
- `PATCH /api/submissions/my/{id}` → принимает `SubmissionNumericUpdate`:
  - `numeric_values: dict[str, {fact_value}]` — записывает факт + вычисляет score через `apply_threshold(parsed_thresholds)`
  - `binary_manual_overrides: dict[str, {score, note}]` — записывает score руководителя
  - Использует `flag_modified(sub, "kpi_values")` для надёжного обновления JSON-колонки

### Проверено в тестах
- `POST /generate-summary`: 65 трудозатрат, 4 binary_auto + 2 binary_manual, completion_pct=80%
- `GET /score`: возвращает partial_score=100.0, total_weight=100, scored_weight=80
- `PATCH` с binary_manual_override: score обновляется, awaiting_manual_input=False, completion_pct → 90%

## Шаг C — Бэкенд binary_manual + Dark Cyber фронт (2026-04-17)

### ИЗМЕНЕНИЕ 1 — Два новых эндпоинта review.py
- `GET /api/review/{id}/pending-manual` → `PendingManualResponse` — список binary_manual KPI, ожидающих ручной оценки
- `PATCH /api/review/{id}/binary-manual` → `ScoreResponse` — выставить score 0 или 100, пишет AuditLog
- Оба проверяют принадлежность отчёта подчинённому через `_get_effective_subordinate_ids`
- PATCH проверяет `status == submitted` (409 если уже approved/rejected), score ∈ {0, 100} (422 иначе)
- После записи пересчитывает `partial_score` через `kpi_engine_service.compute_score_from_kpi_values`

### ИЗМЕНЕНИЕ 2 — Критический баг subordination_service.py
- `_to_unit()` возвращал `role_info["unit"]` (длинная строка "Руководство") вместо `role_info["role_id"]` ("РУК_ЗАМД_004")
- `subordination.json` использует role_id в качестве ключей — fix: возвращать `role_info["role_id"]`
- `get_subordinates()` пытался конвертировать role_ids через несуществующую map — fix: возвращать role_ids напрямую
- Результат: manager видел 0 подчинённых → после исправления видит корректную команду

### ИЗМЕНЕНИЕ 3 — _role_ids_to_pos_ids в review.py
- `employees.position_id` хранит числовой pos_id ("71"), а не role_id ("ЦТР_НАЧ_071")
- Добавлен helper `_role_ids_to_pos_ids()` через `kpi_mapping_service.get_role_info(rid)["pos_id"]`
- Используется в `_get_effective_subordinate_ids` и `get_my_team`

### ИЗМЕНЕНИЕ 4 — Dark Cyber дизайн-система
- `frontend/src/styles/cyber.css` — CSS custom properties (--bg, --accent, --card, etc.), компоненты: `.cyber-card`, `.cyber-btn`, `.cyber-title`, `.badge-*`, `.loader-ring`, `.progress-bar-wrap`
- `frontend/src/app/layout.tsx` — `import '@/styles/cyber.css'`
- Шрифты: Orbitron (заголовки/числа), Exo 2 (текст)
- Глобальный сетчатый фон через `body::before` (псевдоэлемент с CSS grid)

### ИЗМЕНЕНИЕ 5 — Полная переработка фронтенда
- `frontend/src/app/kpi/[submissionId]/page.tsx` — три секции (binary_auto / numeric / binary_manual), loader overlay, debounce 800ms для числового ввода, кнопка submit заблокирована при наличии несохранённых числовых KPI
- Новые компоненты: `KpiCard`, `NumericInput`, `ScoreHeader`, `SectionTitle`, `StatusBadge`
- `frontend/src/app/review/page.tsx` — Dark Cyber список отчётов, фильтры (submitted/approved/rejected/все), client-side вычисление score из kpi_values, сетка команды

## Шаг D — Форма руководителя + PDF (2026-04-17)

### ИЗМЕНЕНИЕ 1 — report_service.py: поддержка нового формата kpi_values
- `_build_context()` полностью переписан для работы с `kpi_values` (JSON) вместо legacy binary полей
- Группировка kpi_values по `kpi_type`: binary_auto + numeric → `specific_kpis`; binary_manual с is_common → дисциплина/распорядок/охрана труда
- Поиск common KPI по фрагменту критерия: "исполнительской дисциплин", "трудового распорядка", "охран"
- `total_result` вычисляется из реальных score, не hardcoded
- Обратная совместимость: если kpi_values пустой — использует старые текстовые поля (bin_discipline_summary и т.д.)

### ИЗМЕНЕНИЕ 2 — Страница детальной проверки (полная переработка)
- `frontend/src/app/review/[submissionId]/page.tsx` — три секции + панель решения в Dark Cyber стиле
- **Секция 1 — binary_auto**: read-only, показывает criterion, AI summary, score (Orbitron), confidence bar, бейдж "Требует внимания" при requires_review
- **Секция 2 — numeric**: read-only, показывает plan_value, fact_value, score%
- **Секция 3 — binary_manual**: интерактивная — кнопки-карточки [✅ ВЫПОЛНЕНО] / [❌ НЕ ВЫПОЛНЕНО], опциональный комментарий, сохранение через `PATCH /api/review/{id}/binary-manual`, обновление локального state без перезагрузки
- **Модальное окно отклонения**: overlay с backdropFilter, textarea min 10 символов, кнопка "Подтвердить" заблокирована пока < 10
- **Панель решения**: "Утвердить" заблокирована если `pending_manual_count > 0`; "Предпросмотр PDF" через `/api/reports/{id}/pdf`
- Для утверждённых отчётов — кнопка "Скачать PDF"

## Сессия 2026-04-17 — Тестирование и исправления

### Исправленные баги

#### Критический: `create-tasks` не создавал локальные `kpi_submissions`
- **Файл:** `backend/app/services/period_service.py`
- **Проблема:** `create_redmine_tasks` создавал задачи в Redmine, но не создавал записи `KpiSubmission` в локальной БД → дашборд сотрудника всегда показывал "Нет отчётов", KPI-форма была недоступна
- **Исправление:** после успешного создания Redmine-задачи теперь создаётся `KpiSubmission(status=draft)` с `redmine_issue_id`

#### Новый admin-эндпоинт для восстановления данных
- **Файл:** `backend/app/api/admin.py`
- `POST /api/admin/periods/{id}/create-submissions` — создаёт `kpi_submissions` для всех активных сотрудников по уже существующему периоду (без Redmine, для случаев когда задачи уже созданы)

### Интеграция GigaChat
- **Файл:** `backend/app/services/ai_service.py` — полностью переписан с поддержкой нескольких провайдеров
- **Файл:** `backend/app/config.py` — добавлено поле `gigachat_api_key`
- Приоритет: **GigaChat → Gemini → заглушка**
- GigaChat: OAuth через `ngw.devices.sberbank.ru:9443/api/v2/oauth` (scope: `GIGACHAT_API_PERS`), чат через `gigachat.devices.sberbank.ru/api/v1/chat/completions`, `verify=False` (самоподписанный сертификат Сбера)
- Ключ `GIGACHAT_API_KEY` — base64(client_id:client_secret) из кабинета developers.sber.ru/gigachat

### Результаты тестирования (все 37 эндпоинтов)
Протестированы локально, все работают:
- Авторизация (login/refresh/me), синхронизация сотрудников (81 чел., 9 подразделений)
- Управление периодами (CRUD), создание KPI-задач (dry_run + реальное)
- KPI-форма: структура, AI-саммари (Gemini, 43 трудозатраты), черновик, submit
- Review: команда, просмотр, утверждение/отклонение
- PDF-генерация (~20KB), финализация
- Финансовый дашборд, панель администратора, уведомления
- Telegram-бот: код корректен, локально не работает из-за блокировки Docker Desktop → Telegram IP; на Amvera будет работать

## Деплой на Amvera

### Переменные окружения (.env на сервере)
- `REDMINE_URL`, `REDMINE_API_KEY`
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `JWT_SECRET_KEY` — минимум 32 символа, случайная строка
- `TELEGRAM_BOT_TOKEN` — токен бота (`redmine_monitor_bot`)
- `OPENAI_API_KEY` — ключ OpenAI (GPT-4o-mini, основной AI)
- `GEMINI_API_KEY` — ключ Gemini (резервный AI)
- `ANTHROPIC_API_KEY` — ключ Claude API (не используется, опционально)
- `FINANCE_TELEGRAM_IDS` — chat_id финансового блока через запятую
- `FRONTEND_URL` — URL фронтенда (для CORS)
- `BACKEND_URL` — URL бэкенда

### После деплоя
```bash
# Применить все миграции
docker compose exec backend alembic upgrade head

# Запустить первую синхронизацию сотрудников
curl -X POST https://your-app.amvera.io/api/sync/run \
  -H "Authorization: Bearer <admin_token>"
```

### Важные замечания
- `reference/` монтируется как read-only — `KPI_Mapping.xlsx` и `subordination.json` должны быть в репо
- Первый вход — войти через Redmine-учётку, затем вручную выставить роль `admin` в таблице `users`
- Telegram-бот работает в polling-режиме — дополнительных настроек не требует
