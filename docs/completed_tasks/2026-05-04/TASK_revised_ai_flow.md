# Задача: Переработать флоу AI-оценки
> Для Claude Code | Прочитай docs/BL_ai_assessment.md (раздел 6) перед началом

---

## КОНТЕКСТ

Флоу AI-оценки полностью переработан. Раньше AI оценивал сразу при нажатии кнопки.
Теперь: сотрудник сначала загружает и редактирует саммари, AI оценивает только в момент отправки.

---

## БЭКЕНД

### 1. Новый эндпоинт — загрузка саммари из Redmine

```
POST /api/submissions/{id}/load-summary
```

**Логика:**
1. Получить `time_entries` из Redmine для сотрудника за период:
   ```
   GET /time_entries.json?user_id={redmine_id}&from={period_start}&to={period_end}&limit=100
   ```
2. Сформировать текст-заготовку саммари:
   ```python
   if not time_entries:
       summary = "Трудозатраты за период не зафиксированы в Redmine."
   else:
       lines = [f"- {e['issue']['subject']} ({e['hours']} ч)" for e in time_entries]
       summary = "\n".join(lines)
   ```
3. Сохранить в `kpi_submissions.summary_text` и `summary_loaded_at = now()`
4. Вернуть `{summary_text, time_entries_count}`

### 2. Новый эндпоинт — сохранение отредактированного саммари

```
PATCH /api/submissions/{id}/summary
Body: {"summary_text": "..."}
```

- Обновить `kpi_submissions.summary_text`
- Только для статуса `draft`
- Debounce на фронтенде (не на бэкенде)

### 3. Изменить эндпоинт отправки на проверку

```
POST /api/submissions/{id}/submit
```

**Новая логика при submit:**
1. Проверить что `summary_text` не пустой → если пустой: 400 «Загрузите саммари перед отправкой»
2. Вызвать YandexGPT с `summary_text` + критериями KPI → получить оценки
3. Сохранить оценки в `kpi_values` (ai_score, ai_confidence, ai_reasoning)
4. Установить флаг `ai_low_confidence = true` если уверенность < 0.5
5. Изменить статус submission → `submitted`
6. Отправить уведомление руководителю в Telegram
7. Вернуть результат оценки AI сотруднику

### 4. Промпт для YandexGPT (исправленный)

```python
prompt = f"""Ты — система оценки KPI государственного учреждения.
Оцени выполнение показателя на основе саммари сотрудника.

Показатель: {indicator.indicator}
Критерий оценки: {indicator.criterion}
Сотрудник: {employee.name}, должность: {role_name}
Период: {period.date_start} — {period.date_end}

Саммари выполненных работ (составлено сотрудником на основе трудозатрат):
{submission.summary_text}

Ответь ТОЛЬКО в формате JSON:
{{
  "score": "выполнено" или "не выполнено",
  "confidence": число от 0.0 до 1.0,
  "reasoning": "краткое обоснование 1-2 предложения"
}}
"""
```

### 5. Миграция БД (Alembic)

Добавить в таблицу `kpi_submissions`:
```sql
ALTER TABLE kpi_submissions ADD COLUMN summary_text TEXT;
ALTER TABLE kpi_submissions ADD COLUMN summary_loaded_at TIMESTAMP;
ALTER TABLE kpi_submissions ADD COLUMN submitted_at TIMESTAMP;
```

Добавить в таблицу `kpi_values`:
```sql
ALTER TABLE kpi_values ADD COLUMN ai_confidence FLOAT;
ALTER TABLE kpi_values ADD COLUMN ai_reasoning TEXT;
ALTER TABLE kpi_values ADD COLUMN ai_low_confidence BOOLEAN DEFAULT FALSE;
```

---

## ФРОНТЕНД

### Файл: frontend/src/app/kpi/[id]/page.tsx

### Изменить кнопку

**Было:**
```tsx
<button>⚡ Сгенерировать AI-оценку</button>
```

**Стало:**
```tsx
<button onClick={handleLoadSummary}>
  📥 Загрузить саммари из Redmine
</button>
```

### Новый блок — редактор саммари

После загрузки показывать между кнопками и блоком показателей:

```tsx
{summaryText !== null && (
  <div className="cyber-card">
    <div style={{color: 'var(--accent)', fontSize: 12, marginBottom: 8}}>
      САММАРИ ВЫПОЛНЕННЫХ РАБОТ
    </div>
    <textarea
      value={summaryText}
      onChange={e => handleSummaryChange(e.target.value)}
      disabled={submission.status !== 'draft'}
      rows={6}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(0,229,255,0.3)',
        borderRadius: 8,
        color: 'white',
        padding: 12,
        fontFamily: 'Exo 2, sans-serif',
        fontSize: 14,
        resize: 'vertical'
      }}
    />
    <div style={{fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4}}>
      Вы можете отредактировать саммари перед отправкой
    </div>
  </div>
)}
```

### Обработчики

```typescript
const [summaryText, setSummaryText] = useState<string | null>(null)
const [summaryLoading, setSummaryLoading] = useState(false)

const handleLoadSummary = async () => {
  setSummaryLoading(true)
  const res = await fetch(`/api/submissions/${id}/load-summary`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  const data = await res.json()
  setSummaryText(data.summary_text)
  setSummaryLoading(false)
}

// Debounce сохранения (800ms)
const handleSummaryChange = debounce(async (text: string) => {
  setSummaryText(text)
  await fetch(`/api/submissions/${id}/summary`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary_text: text })
  })
}, 800)
```

### Изменить кнопку «Отправить на проверку»

При клике:
1. Показать лоадер «AI анализирует...»
2. Вызвать `POST /api/submissions/{id}/submit`
3. Получить результат → показать оценки AI на странице
4. Если есть показатели с `ai_low_confidence=true` → показать предупреждение:
   ```
   ⚠️ AI оценил 1 показатель с низкой уверенностью (< 50%).
   Руководитель примет финальное решение по этим показателям.
   ```
5. Форма переходит в read-only

### Блок AI-оценки после submit

Показывать для каждого binary_auto показателя:
- Оценка: ✅ Выполнено / ❌ Не выполнено
- Уверенность AI: прогресс-бар (зелёный ≥ 50%, жёлтый < 50%)
- Обоснование: курсивный текст серого цвета
- Если `ai_low_confidence`: бейдж `⚠️ Низкая уверенность`

---

## БАГ — binary_manual попадает в блок AI

В методе разбивки показателей по блокам исправить фильтрацию:

```python
# ПРАВИЛЬНО:
ai_indicators = [i for i in indicators if i.formula_type == 'binary_auto']
manager_indicators = [i for i in indicators if i.formula_type == 'binary_manual']
# is_common НЕ влияет на блок
```

---

## Чеклист готовности

- [ ] Миграция БД применена
- [ ] `POST /api/submissions/{id}/load-summary` работает, возвращает time_entries текстом
- [ ] `PATCH /api/submissions/{id}/summary` сохраняет отредактированный текст
- [ ] При submit — AI оценивает на основе summary_text, не придумывает
- [ ] После submit — форма read-only, оценки AI видны
- [ ] Предупреждение при уверенности < 50%
- [ ] Все binary_manual → блок руководителя (включая is_common=true)
- [ ] Telegram-уведомление руководителю содержит итог AI-оценки
