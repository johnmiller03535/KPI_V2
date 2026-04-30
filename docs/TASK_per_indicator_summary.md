# Задача: Саммари по каждому показателю отдельно
> Для Claude Code | Прочитай docs/BL_ai_assessment.md перед началом

---

## КОНТЕКСТ

Сейчас: одно общее саммари для всего отчёта.
Нужно: для каждого binary_auto показателя — своё саммари на основе трудозатрат.

---

## БЭКЕНД — POST /api/submissions/my/{id}/load-summary

### Новая логика

```python
# 1. Получить все time_entries за период
work_entries = [...]  # как сейчас

# 2. Получить список binary_auto показателей из kpi_values
auto_indicators = [k for k in submission.kpi_values 
                   if k['formula_type'] == 'binary_auto']

# 3. Для каждого показателя — вызвать AI чтобы:
#    а) отобрал релевантные задачи из work_entries
#    б) написал саммари по этому показателю

indicator_summaries = {}
for indicator in auto_indicators:
    summary = await generate_indicator_summary(
        indicator=indicator,
        work_entries=work_entries,
        role_name=role_name
    )
    indicator_summaries[indicator['id']] = summary

# 4. Сохранить в kpi_values каждого показателя поле 'summary'
for k in submission.kpi_values:
    if k['formula_type'] == 'binary_auto':
        k['summary'] = indicator_summaries.get(k['id'], '')

# 5. Общее summary_text = объединение всех саммари (для совместимости)
submission.summary_text = '\n\n'.join(indicator_summaries.values())
```

### Промпт для generate_indicator_summary

```python
async def generate_indicator_summary(indicator, work_entries, role_name):
    tasks_text = '\n'.join(
        f"- [{e['issue']['subject']}] {e.get('comments','').strip()}"
        for e in work_entries
        if e.get('issue', {}).get('subject')
    )
    # Дедупликация
    lines = list(dict.fromkeys(tasks_text.strip().split('\n')))
    tasks_text = '\n'.join(lines)

    prompt = f"""Ты составляешь фрагмент отчёта KPI.

Должность: {role_name}
Показатель: {indicator['indicator']}
Критерий оценки: {indicator['criterion']}

Все выполненные задачи за период:
{tasks_text}

Задача:
1. Выбери из списка ТОЛЬКО задачи которые относятся к данному показателю
2. Если задача подходит к показателю — включи её в саммари
3. Напиши деловое саммари выполненных работ по ЭТОМУ показателю
4. Если ни одна задача не относится к показателю — напиши:
   "Работы по данному направлению в трудозатратах не зафиксированы"
5. Период НЕ упоминать, стиль деловой
6. Только факты — не придумывай
"""
    return await call_yandex_gpt(prompt)
```

---

## БЭКЕНД — PATCH /api/submissions/my/{id}/summary

Изменить: принимать `indicator_id` + `summary_text` для конкретного показателя:

```python
# Новый формат тела запроса:
{
    "indicator_id": "uuid-показателя",  # если null → обновить общее summary_text
    "summary_text": "новый текст"
}

# Логика:
if body.indicator_id:
    # Найти kpi_value по id и обновить его поле 'summary'
    for k in submission.kpi_values:
        if k['id'] == body.indicator_id:
            k['summary'] = body.summary_text
            break
    submission.kpi_values = submission.kpi_values  # триггер обновления
else:
    submission.summary_text = body.summary_text
```

---

## БЭКЕНД — POST /api/submissions/my/{id}/submit

При оценке AI — передавать `kpi_value['summary']` вместо общего `summary_text`:

```python
for kpi in auto_indicators:
    indicator_summary = kpi.get('summary') or submission.summary_text or ''
    score = await evaluate_binary_kpi(indicator, indicator_summary)
```

---

## ФРОНТЕНД — frontend/src/app/kpi/[id]/page.tsx

### Блок саммари

Убрать одно общее поле.
Вместо него — под каждым binary_auto показателем своё поле:

```tsx
{/* Внутри карточки binary_auto показателя */}
<div style={{marginTop: 12}}>
  <div style={{fontSize: 11, color: 'var(--accent)', marginBottom: 6}}>
    САММАРИ ПО ПОКАЗАТЕЛЮ
  </div>
  <textarea
    value={kpi.summary || ''}
    onChange={e => handleIndicatorSummaryChange(kpi.id, e.target.value)}
    disabled={submission.status !== 'draft'}
    rows={4}
    style={{
      width: '100%',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(0,229,255,0.3)',
      borderRadius: 8, color: 'white',
      padding: 12, fontFamily: 'Exo 2, sans-serif',
      fontSize: 13, resize: 'vertical'
    }}
    placeholder="Нажмите «Загрузить саммари» для автозаполнения"
  />
</div>
```

### Кнопка «Загрузить саммари»

Остаётся одна кнопка для всех показателей сразу.
После загрузки каждый показатель получает своё поле заполненным.

### Обработчик изменения

```typescript
const handleIndicatorSummaryChange = debounce(async (indicatorId: string, text: string) => {
  // Обновить локальный state
  setSubmission(prev => ({
    ...prev,
    kpi_values: prev.kpi_values.map(k => 
      k.id === indicatorId ? {...k, summary: text} : k
    )
  }))
  // Сохранить на бэкенд
  await fetch(`/api/submissions/my/${id}/summary`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ indicator_id: indicatorId, summary_text: text })
  })
}, 800)
```

---

## PDF — report_service.py

В колонке «Мероприятия» для binary_auto показателя использовать:
```python
# Сначала ищем summary конкретного показателя
activities = kpi_value.get('summary') or submission.summary_text or '—'
```

---

## Чеклист
- [ ] load-summary генерирует отдельное саммари для каждого binary_auto
- [ ] kpi_values каждого показателя содержит поле `summary`
- [ ] PATCH /summary принимает indicator_id
- [ ] submit использует kpi.summary для оценки AI
- [ ] Фронтенд: textarea под каждым binary_auto показателем
- [ ] PDF: каждая строка binary_auto получает своё саммари
- [ ] Пересобрать и проверить
