# Задача: Исследование Redmine API
> Для Claude Code | Результаты сохранить в `docs/redmine_api_research.json`

## Цель
Изучить какие данные о структуре организации доступны в Redmine API.
Результаты нужны для принятия решения — можно ли автоматически строить матрицу подчинённости из Redmine.

## Что делать

Выполни следующие curl-запросы и сохрани все результаты в `docs/redmine_api_research.json`.

### 1. Список пользователей (первые 100)
```bash
curl -s "https://kkp.rm.mosreg.ru/users.json?limit=100" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure
```

### 2. Группы
```bash
curl -s "https://kkp.rm.mosreg.ru/groups.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure
```

### 3. Проекты
```bash
curl -s "https://kkp.rm.mosreg.ru/projects.json?limit=100" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure
```

### 4. Детали одного пользователя (ZaichkoVV, user_id=373)
```bash
curl -s "https://kkp.rm.mosreg.ru/users/373.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure
```

### 5. Кастомные поля
```bash
curl -s "https://kkp.rm.mosreg.ru/custom_fields.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure
```

### 6. Участники одного kpi-проекта (возьми первый kpi-проект из результата запроса 3)
```bash
curl -s "https://kkp.rm.mosreg.ru/projects/{identifier}/memberships.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure
```

## Формат результата

Сохрани в `docs/redmine_api_research.json`:
```json
{
  "users_sample": { ...ответ API... },
  "groups": { ...ответ API... },
  "projects": { ...ответ API... },
  "user_detail_373": { ...ответ API... },
  "custom_fields": { ...ответ API... },
  "project_memberships_sample": { ...ответ API... }
}
```

Если какой-то запрос вернул ошибку — записать `{"error": "текст ошибки"}`.

## Важно
- Флаг `--insecure` обязателен (самоподписанный сертификат)
- Не выводить результаты в консоль — только в файл
- После сохранения написать в консоль: `✅ Готово: docs/redmine_api_research.json`
