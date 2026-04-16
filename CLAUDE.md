# CLAUDE.md — KPI Портал ГКУ МО «РЦТ»

> Обновляется в конце каждой сессии. Последнее обновление: 2026-04-16 (этап 8)

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
| AI | Claude API (claude-sonnet) |
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
- `AIService.summarize_time_entries` — Claude API (`claude-sonnet-4-6`), промт → JSON с criteria/general_summary/discipline_summary; заглушка при пустых трудозатратах
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

## Деплой на Amvera

### Переменные окружения (.env на сервере)
- `REDMINE_URL`, `REDMINE_API_KEY`
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `JWT_SECRET_KEY` — минимум 32 символа, случайная строка
- `TELEGRAM_BOT_TOKEN` — токен бота
- `ANTHROPIC_API_KEY` — ключ Claude API
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
