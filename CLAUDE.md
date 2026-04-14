# CLAUDE.md — KPI Портал ГКУ МО «РЦТ»

> Обновляется в конце каждой сессии. Последнее обновление: 2026-04-14 (этап 3)

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
| 4 | KPI-форма сотрудника + Claude API | ⏳ |
| 5 | Дашборд руководителя + утверждение | ⏳ |
| 6 | Генерация PDF + запись в Redmine | ⏳ |
| 7 | Система напоминаний | ⏳ |
| 8 | Telegram-бот (руководители) | ⏳ |
| 9 | Панель администратора | ⏳ |
| 10 | Финансовый дашборд | ⏳ |

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
