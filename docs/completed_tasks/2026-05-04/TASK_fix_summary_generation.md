# Задача: Исправить формирование саммари из трудозатрат
> Для Claude Code | Файл: backend/app/services/kpi_engine_service.py

---

## КОНТЕКСТ

При загрузке саммари из Redmine возвращается сырой список задач вместо 
связного текста. Также есть записи без названия задачи — это отпуск/больничный.

---

## ИСПРАВЛЕНИЕ 1 — Классификация записей time_entries

При обработке time_entries разделить на три категории:

```python
work_entries = []      # обычные задачи
absence_entries = []   # отпуск/больничный
unknown_entries = []   # прочее без задачи

for entry in time_entries:
    issue_subject = entry.get('issue', {}).get('subject', '')
    
    if not issue_subject or issue_subject == employee.name:
        # Запись без задачи = отпуск или больничный
        # В Redmine это трудозатраты на проект без задачи
        absence_entries.append(entry)
    elif any(word in issue_subject.lower() for word in 
             ['отпуск', 'больничный', 'отгул', 'командировка']):
        absence_entries.append(entry)
    else:
        work_entries.append(entry)

absence_hours = sum(e['hours'] for e in absence_entries)
work_hours = sum(e['hours'] for e in work_entries)
```

**Отпуск/больничный в саммари не включать** — только упомянуть если > 0:
```
# В промпт добавить если есть:
absence_note = f"Примечание: {absence_hours} ч — отпуск/больничный (не учитывается в оценке)" 
               if absence_hours > 0 else ""
```

---

## ИСПРАВЛЕНИЕ 2 — AI генерирует саммари при load-summary

Вместо возврата сырого списка — вызывать YandexGPT для формирования текста.

```python
# Список задач для промпта (без часов, без дублей)
unique_tasks = list(dict.fromkeys([e['issue']['subject'] for e in work_entries]))
tasks_text = "\n".join(f"- {task}" for task in unique_tasks)

prompt = f"""Ты — система подготовки отчётов KPI государственного учреждения.
Составь формальное саммари выполненных работ.

Должность: {role_name}
Показатель KPI: {indicator.indicator}
Период: {period_start} — {period_end}

Выполненные задачи:
{tasks_text}

{absence_note}

Требования:
1. Сгруппируй задачи по смыслу (аналитика, совещания, разработка, координация)
2. Связный текст 3-5 предложений без упоминания часов и дат
3. Деловой стиль: "Проведена...", "Подготовлены...", "Выполнена..."
4. Только факты из списка — не придумывай
5. Если список пуст — напиши: "Рабочие задачи за период не зафиксированы"
"""
```

---

## ИСПРАВЛЕНИЕ 3 — binary_manual в блок руководителя

В методе разбивки показателей по блокам:

```python
# ТОЛЬКО по formula_type, is_common не влияет на блок:
ai_indicators = [i for i in indicators if i.formula_type == 'binary_auto']
manager_indicators = [i for i in indicators if i.formula_type == 'binary_manual']
numeric_indicators = [i for i in indicators if i.formula_type in (
    'threshold', 'multi_threshold', 'quarterly_threshold'
)]
```

---

## Чеклист

- [ ] Записи без задачи (отпуск/больничный) не попадают в саммари
- [ ] Если есть часы отпуска — добавляется примечание
- [ ] load-summary возвращает AI-сгенерированный связный текст, не список
- [ ] Дублирующиеся задачи в промпт не передаются (unique)
- [ ] Все binary_manual → блок руководителя
