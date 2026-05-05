# Задача: Руководитель может переопределить оценку AI
> Файл: frontend/src/app/review/[id]/page.tsx + backend/app/api/review.py

## Бизнес-логика

Руководитель видит AI-оценку как рекомендацию, но принимает финальное решение сам.
Это особенно важно когда AI оценил с низкой уверенностью (< 50%).

## Фронтенд — блок AI-оценки в форме проверки

### Было
Показатели binary_auto отображаются как read-only — только оценка AI и обоснование.

### Стало
Под каждым binary_auto показателем добавить кнопки переопределения:

```tsx
{/* Под блоком с AI-оценкой и обоснованием */}
<div style={{marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12}}>
  <div style={{fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8}}>
    РЕШЕНИЕ РУКОВОДИТЕЛЯ (переопределяет AI)
  </div>
  <div style={{display: 'flex', gap: 8}}>
    <button
      onClick={() => handleManagerOverride(kpi.id, true)}
      style={{
        flex: 1, padding: '8px',
        background: managerScore === true ? 'rgba(0,255,157,0.2)' : 'transparent',
        border: managerScore === true ? '1px solid #00ff9d' : '1px solid rgba(255,255,255,0.2)',
        color: managerScore === true ? '#00ff9d' : 'rgba(255,255,255,0.6)',
        borderRadius: 6, cursor: 'pointer', fontSize: 13
      }}
    >
      ✅ Подтвердить выполнение
    </button>
    <button
      onClick={() => handleManagerOverride(kpi.id, false)}
      style={{
        flex: 1, padding: '8px',
        background: managerScore === false ? 'rgba(255,59,92,0.2)' : 'transparent',
        border: managerScore === false ? '1px solid #ff3b5c' : '1px solid rgba(255,255,255,0.2)',
        color: managerScore === false ? '#ff3b5c' : 'rgba(255,255,255,0.6)',
        borderRadius: 6, cursor: 'pointer', fontSize: 13
      }}
    >
      ❌ Не выполнено
    </button>
  </div>
  {managerScore !== null && managerScore !== (kpi.ai_score === 'выполнено') && (
    <div style={{fontSize: 11, color: '#ffb800', marginTop: 6}}>
      ⚠️ Решение руководителя отличается от оценки AI
    </div>
  )}
</div>
```

По умолчанию кнопки не выбраны — руководитель должен явно принять решение.
Если руководитель не нажал ни одну кнопку — считается что он согласен с AI.

### Логика итоговой оценки

```
Если manager_override задан → использовать manager_override
Если manager_override не задан → использовать ai_score
```

## Бэкенд

### Новое поле в kpi_values (миграция)
```sql
ALTER TABLE kpi_values ADD COLUMN manager_override BOOLEAN DEFAULT NULL;
-- NULL = руководитель не переопределял (используется ai_score)
-- TRUE = руководитель подтвердил выполнение
-- FALSE = руководитель отклонил
```

### Эндпоинт переопределения
```
PATCH /api/review/submissions/{id}/kpi/{kpi_id}/override
Body: {"manager_override": true/false}
```

- Только роль manager/admin
- Только для статуса submitted
- Обновить `kpi_values[kpi_id].manager_override`
- Пересчитать итоговый балл

### Пересчёт итогового балла
```python
def calculate_score(kpi_value):
    if kpi_value.formula_type == 'binary_auto':
        # Приоритет: manager_override > ai_score
        if kpi_value.manager_override is not None:
            effective_score = kpi_value.manager_override
        else:
            effective_score = (kpi_value.ai_score == 'выполнено')
        return kpi_value.weight if effective_score else 0
    elif kpi_value.formula_type == 'binary_manual':
        return kpi_value.weight if kpi_value.manual_score else 0
    # ... threshold логика
```

### В PDF и итоговом отчёте
Если manager_override отличается от ai_score — добавить пометку:
«Решение руководителя (отличается от оценки AI)»

## Чеклист
- [ ] Миграция добавляет manager_override в kpi_values
- [ ] Кнопки переопределения видны под каждым binary_auto показателем
- [ ] PATCH эндпоинт сохраняет manager_override
- [ ] Итоговый балл пересчитывается с учётом override
- [ ] Предупреждение если решение отличается от AI
- [ ] PDF помечает переопределённые показатели
