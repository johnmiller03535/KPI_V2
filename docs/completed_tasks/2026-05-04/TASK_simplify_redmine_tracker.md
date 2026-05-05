# Задача: Упростить создание задач в Redmine — один трекер
> Для Claude Code | Файл: backend/app/services/period_service.py

---

## КОНТЕКСТ

Было: 91 трекер (по одному на каждую должность КПИ_ОТЧЁТ_{role_id})
Стало: один трекер «KPI_ОТЧЁТ» для всех задач

Трудозатраты сотрудник списывает в свои рабочие задачи как обычно.
Задача KPI — только контейнер для отчёта.
PDF прикрепляется к задаче после утверждения.

---

## ШАГ 1 — Создать трекер в Redmine вручную

Администратор должен создать трекер:
- Название: `KPI_ОТЧЁТ`
- В проекте: `kpi-reports`

После создания — найти его ID:
```bash
curl -s "https://kkp.rm.mosreg.ru/trackers.json" \
  -H "X-Redmine-API-Key: 5f498fb9d36bd82c84edef1851e921b84a302dfa" \
  --insecure | python3 -m json.tool | grep -A2 "KPI_ОТЧЁТ"
```

Записать tracker_id в `.env`:
```
KPI_TRACKER_ID=<id>
```

---

## ШАГ 2 — Упростить period_service.py

### Убрать логику выбора трекера по role_id

Найти метод `_get_tracker_id` или аналог — убрать полностью.

### Новое название задачи

```python
# Было:
subject = f"Отчёт KPI — {employee.name} — {period.name}"

# Стало (без изменений в названии, просто убрать трекер по role_id):
subject = f"Отчёт KPI — {employee.lastname} {employee.firstname} — {period.name}"
```

### Использовать один трекер

```python
import os
KPI_TRACKER_ID = int(os.getenv("KPI_TRACKER_ID", 1))

# При создании задачи:
issue_data = {
    "issue": {
        "project_id": "kpi-reports",
        "tracker_id": KPI_TRACKER_ID,
        "subject": subject,
        "assigned_to_id": employee.redmine_id,
        "description": f"Отчётный период: {period.date_start} — {period.date_end}"
    }
}
```

---

## ШАГ 3 — Прикреплять PDF к задаче после утверждения

В `backend/app/api/review.py` метод `decide_submission` (approve):

После утверждения — сгенерировать PDF и прикрепить к задаче Redmine:

```python
if decision == "approve" and submission.redmine_issue_id:
    try:
        # Генерировать PDF
        pdf_bytes = await report_service.generate_pdf(submission_id, db)
        
        # Загрузить файл в Redmine (двухшаговый процесс)
        # Шаг 1: загрузить файл → получить token
        upload_resp = await redmine_client.upload_file(
            pdf_bytes,
            filename=f"KPI_{submission.employee_login}_{submission.period_name}.pdf"
        )
        token = upload_resp["upload"]["token"]
        
        # Шаг 2: прикрепить к задаче через PUT /issues/{id}
        await redmine_client.attach_to_issue(
            issue_id=submission.redmine_issue_id,
            token=token,
            filename=f"KPI_{submission.employee_login}_{submission.period_name}.pdf",
            content_type="application/pdf"
        )
    except Exception as e:
        logger.warning(f"Не удалось прикрепить PDF к задаче: {e}")
        # Не блокировать утверждение если PDF не прикрепился
```

### Методы для redmine_client (добавить в backend/app/core/redmine.py):

```python
async def upload_file(self, file_bytes: bytes, filename: str) -> dict:
    """POST /uploads.json — загрузить файл, получить token"""
    resp = await self._post(
        "/uploads.json",
        data=file_bytes,
        headers={"Content-Type": "application/octet-stream"},
        params={"filename": filename}
    )
    return resp

async def attach_to_issue(self, issue_id: int, token: str, 
                           filename: str, content_type: str):
    """PUT /issues/{id}.json — прикрепить загруженный файл"""
    await self._put(
        f"/issues/{issue_id}.json",
        json={
            "issue": {
                "uploads": [{
                    "token": token,
                    "filename": filename,
                    "content_type": content_type
                }]
            }
        }
    )
```

---

## Чеклист
- [ ] Трекер `KPI_ОТЧЁТ` создан в Redmine вручную
- [ ] `KPI_TRACKER_ID` добавлен в `.env`
- [ ] `_get_tracker_id` убран из period_service.py
- [ ] Задачи создаются с единым трекером
- [ ] `upload_file` и `attach_to_issue` добавлены в redmine.py
- [ ] PDF прикрепляется к задаче при утверждении
- [ ] Если прикрепление не удалось — утверждение не блокируется
