# Задача: Проверить поле «Менеджер» в Redmine API
> Результат сохранить в docs/redmine_people_api.json

## Контекст
Поле «Менеджер» в карточке сотрудника Redmine — это прямой руководитель.
Именно оно будет основой матрицы подчинённости.
Нужно выяснить как это поле доступно через API.

## Запросы

```bash
# 1. Пользователь через /users/ — есть ли там manager?
curl -s "https://kkp.rm.mosreg.ru/users/373.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure

# 2. Пользователь через /people/ (плагин HRM)
curl -s "https://kkp.rm.mosreg.ru/people/373.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure

# 3. Список через /people/
curl -s "https://kkp.rm.mosreg.ru/people.json?limit=10" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure

# 4. Ещё один сотрудник — например VinokurovMiA (user_id=289, ЦТР_НАЧ_071)
curl -s "https://kkp.rm.mosreg.ru/people/289.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure

# 5. Рядовой сотрудник ЦТР — AgevninaViA (user_id=412, КПИ_Номер=77)
curl -s "https://kkp.rm.mosreg.ru/people/412.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure
```

## Что ищем в ответе
- Поле `manager` или `supervisor` или аналог
- Как передаётся: `{id, name}` или просто id?
- Доступно ли поле в `/users/` или только в `/people/`?
- Какие ещё полезные поля есть в `/people/` но нет в `/users/`

## Сохранить в docs/redmine_people_api.json
```json
{
  "users_373": { ...ответ /users/373... },
  "people_373": { ...ответ /people/373... },
  "people_list": { ...ответ /people/?limit=10... },
  "people_289": { ...ответ /people/289... },
  "people_412": { ...ответ /people/412... },
  "notes": "краткий вывод — где находится поле manager и как выглядит"
}
```
