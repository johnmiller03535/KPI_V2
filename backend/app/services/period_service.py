import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.redmine import redmine_client
from app.models.period import Period, PeriodStatus
from app.models.period_exception import PeriodException, ExceptionType
from app.models.employee import Employee, EmployeeStatus
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.services.kpi_mapping_service import kpi_mapping_service

logger = logging.getLogger(__name__)

# Маппинг department_code → Redmine project identifier
DEPT_PROJECT_MAP = {
    "kpi-ruk": "kpi-ruk",
    "kpi-org": "kpi-org",
    "kpi-pra": "kpi-pra",
    "kpi-kza": "kpi-kza",
    "kpi-zpd": "kpi-zpd",
    "kpi-zpr": "kpi-zpr",
    "kpi-tsr": "kpi-tsr",
    "kpi-feo": "kpi-feo",
    "kpi-iaa": "kpi-iaa",
}

# ID кастомных полей задачи в Redmine (из старого проекта)
CF_PERIOD = 205      # Период отчётности
CF_ROLE_ID = 206     # Идентификатор должности


def _build_issue_subject(employee: Employee, period: Period) -> str:
    """Формирует название задачи: 'Отчёт KPI — Фамилия — Март 2026'"""
    return f"Отчёт KPI — {employee.lastname} — {period.name}"


def _build_issue_description(employee: Employee, period: Period) -> str:
    """Формирует HTML-описание задачи."""
    return f"""<h4>KPI-отчёт сотрудника</h4>
<ul>
<li><strong>Сотрудник:</strong> {employee.full_name}</li>
<li><strong>Подразделение:</strong> {employee.department_name}</li>
<li><strong>Период:</strong> {period.name}</li>
<li><strong>Дата начала:</strong> {period.date_start}</li>
<li><strong>Дата окончания:</strong> {period.date_end}</li>
<li><strong>Срок сдачи:</strong> {period.submit_deadline}</li>
<li><strong>Срок проверки:</strong> {period.review_deadline}</li>
</ul>"""


class PeriodService:

    async def create_redmine_tasks(self, period: Period, db: AsyncSession,
                                   dry_run: bool = False) -> dict:
        """
        Создаёт задачи KPI в Redmine для всех активных сотрудников периода.
        Пропускает сотрудников с исключениями типа excluded/maternity.
        Возвращает статистику.
        """
        stats = {"created": 0, "skipped": 0, "errors": 0, "details": []}

        # Получить исключения для периода
        exc_result = await db.execute(
            select(PeriodException).where(PeriodException.period_id == period.id)
        )
        exceptions = {e.employee_redmine_id: e for e in exc_result.scalars().all()}

        # Получить всех активных сотрудников
        emp_result = await db.execute(
            select(Employee).where(Employee.status == EmployeeStatus.active)
        )
        employees = emp_result.scalars().all()

        logger.info(f"Создание задач для периода '{period.name}': {len(employees)} сотрудников")

        # Загружаем список трекеров из Redmine один раз
        redmine_trackers: dict[str, int] = {}
        if not dry_run:
            redmine_trackers = await redmine_client.get_trackers()
            logger.info(f"Загружено трекеров из Redmine: {len(redmine_trackers)}")

        for emp in employees:
            try:
                # Проверить исключения
                exc = exceptions.get(emp.redmine_id)
                if exc and exc.exception_type in [ExceptionType.excluded, ExceptionType.maternity]:
                    stats["skipped"] += 1
                    stats["details"].append({
                        "action": "skipped",
                        "login": emp.login,
                        "reason": exc.exception_type.value,
                    })
                    continue

                if not emp.department_code or emp.department_code not in DEPT_PROJECT_MAP:
                    stats["skipped"] += 1
                    stats["details"].append({
                        "action": "skipped",
                        "login": emp.login,
                        "reason": "no_department",
                    })
                    continue

                project_id = DEPT_PROJECT_MAP[emp.department_code]
                subject = _build_issue_subject(emp, period)
                description = _build_issue_description(emp, period)

                # Кастомные поля задачи
                custom_fields = [
                    {"id": CF_PERIOD, "value": period.name},
                ]
                if emp.position_id:
                    custom_fields.append({"id": CF_ROLE_ID, "value": emp.position_id})

                if dry_run:
                    stats["created"] += 1
                    stats["details"].append({
                        "action": "dry_run",
                        "login": emp.login,
                        "project": project_id,
                        "subject": subject,
                    })
                    continue

                tracker_id = self._get_tracker_id(emp, project_id, redmine_trackers)

                # Диагностическое логирование перед созданием задачи
                _role_id = kpi_mapping_service.pos_id_to_role_id(str(emp.position_id)) if emp.position_id else None
                _tracker_name = f"KPI_ОТЧЁТ_{_role_id}" if _role_id else "—"
                logger.info(
                    f"CREATE TASK | {emp.full_name} | login={emp.login} | "
                    f"position_id={emp.position_id} | role_id={_role_id} | "
                    f"tracker_name={_tracker_name} | tracker_id={tracker_id} | "
                    f"project={project_id}"
                )

                issue = await redmine_client.create_issue(
                    project_id=project_id,
                    subject=subject,
                    description=description,
                    tracker_id=tracker_id,
                    assigned_to_id=int(emp.redmine_id),
                    custom_fields=custom_fields,
                )

                if issue:
                    stats["created"] += 1
                    stats["details"].append({
                        "action": "created",
                        "login": emp.login,
                        "issue_id": issue["id"],
                        "project": project_id,
                    })
                    submission = KpiSubmission(
                        employee_redmine_id=emp.redmine_id,
                        employee_login=emp.login,
                        period_id=period.id,
                        period_name=period.name,
                        position_id=emp.position_id,
                        redmine_issue_id=issue["id"],
                        status=SubmissionStatus.draft,
                    )
                    db.add(submission)
                else:
                    stats["errors"] += 1
                    stats["details"].append({
                        "action": "error",
                        "login": emp.login,
                        "reason": "redmine_api_error",
                    })

            except Exception as e:
                stats["errors"] += 1
                stats["details"].append({
                    "action": "error",
                    "login": emp.login,
                    "reason": str(e),
                })
                logger.error(f"Ошибка создания задачи для {emp.login}: {e}")

        if not dry_run:
            period.redmine_tasks_created = True
            period.redmine_tasks_count = stats["created"]
            period.status = PeriodStatus.active
            await db.commit()

        logger.info(
            f"Задачи созданы: {stats['created']}, "
            f"пропущено: {stats['skipped']}, ошибок: {stats['errors']}"
        )
        return stats

    def _get_tracker_id(self, employee: Employee, project_id: str,
                        redmine_trackers: dict[str, int]) -> int:
        """
        Возвращает tracker_id для сотрудника по его role_id.
        Паттерн имени трекера: KPI_ОТЧЁТ_{role_id}, напр. KPI_ОТЧЁТ_ЦТР_КОН_075.
        Если трекер не найден — fallback на первый трекер подразделения.
        """
        dept_tracker_fallback = {
            "kpi-ruk": 186,
            "kpi-org": 188,
            "kpi-pra": 196,
            "kpi-kza": 204,
            "kpi-zpd": 212,
            "kpi-zpr": 222,
            "kpi-tsr": 232,
            "kpi-feo": 242,
            "kpi-iaa": 252,
        }
        fallback = dept_tracker_fallback.get(project_id, 186)

        if not employee.position_id:
            logger.warning(f"{employee.login}: нет position_id, используем fallback tracker {fallback}")
            return fallback

        role_id = kpi_mapping_service.pos_id_to_role_id(str(employee.position_id))
        if not role_id:
            logger.warning(
                f"{employee.login}: position_id={employee.position_id} не найден в KPI_Mapping, "
                f"используем fallback tracker {fallback}"
            )
            return fallback

        tracker_name = f"KPI_ОТЧЁТ_{role_id}"
        tracker_id = redmine_trackers.get(tracker_name)
        if not tracker_id:
            logger.warning(
                f"{employee.login}: трекер '{tracker_name}' не найден в Redmine, "
                f"используем fallback tracker {fallback}"
            )
            return fallback

        logger.info(f"{employee.login}: role_id={role_id}, tracker='{tracker_name}' (id={tracker_id})")
        return tracker_id


period_service = PeriodService()
