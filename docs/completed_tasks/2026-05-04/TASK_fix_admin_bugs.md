# Задача: Исправить три бага в admin/page.tsx
> Для Claude Code | Файл: frontend/src/app/admin/page.tsx

---

## БАГ 1 — ReferenceError: showDismissedModal is not defined (строка 816)

### Причина
При переносе модального окна в JSX-структуру потерялись объявления состояний.

### Что добавить в начало компонента (рядом с другими useState)
```typescript
const [showDismissedModal, setShowDismissedModal] = useState(false)
const [dismissedEmployees, setDismissedEmployees] = useState<DismissedEmployee[]>([])
const [loadingDismissed, setLoadingDismissed] = useState(false)
```

### Функция загрузки (добавить рядом с другими handlers)
```typescript
const handleShowDismissed = async () => {
  setShowDismissedModal(true)
  if (dismissedEmployees.length > 0) return // уже загружено
  setLoadingDismissed(true)
  try {
    const res = await fetch('/api/admin/employees/dismissed', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    setDismissedEmployees(data)
  } catch (e) {
    console.error(e)
  } finally {
    setLoadingDismissed(false)
  }
}
```

### Карточка «УВОЛЕННЫХ» — добавить onClick
```tsx
onClick={handleShowDismissed}
style={{ cursor: 'pointer' }}
```

---

## БАГ 2 — Карточка «БЕЗ TELEGRAM» не кликабельна

### Что сделать
Аналогично уволенным — при клике показывать модальное окно со списком сотрудников без Telegram.

Добавить состояния:
```typescript
const [showNoTelegramModal, setShowNoTelegramModal] = useState(false)
```

Данные уже есть в `data-health` ответе (`without_telegram_id`) — не нужен отдельный эндпоинт.
При клике просто показать модалку с данными из уже загруженного `healthData.without_telegram_id`.

Модальное окно — таблица: ФИО / Должность (position_id) / кнопка «Открыть в Redmine» 
(ссылка `https://kkp.rm.mosreg.ru/people/{redmine_id}/edit`).

---

## БАГ 3 — Таб «Аудит» выдаёт ошибку

### Что сделать
Найти что именно падает в табе «Аудит» — скорее всего обращение к полю которого нет в ответе API.
Добавить защитные проверки (`?.` optional chaining) на все поля аудит-записей.
Если данных нет — показать заглушку «Нет записей» вместо ошибки.

---

## Чеклист
- [ ] `showDismissedModal` объявлен как useState — ошибка исчезла
- [ ] Клик на «Уволенных» открывает модалку со списком
- [ ] Клик на «Без Telegram» открывает модалку со ссылками в Redmine
- [ ] Таб «Аудит» не падает, показывает данные или заглушку
- [ ] Все модалки закрываются кнопкой и кликом на фон
