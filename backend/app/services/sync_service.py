import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.redmine import redmine_client
from app.models.employee import Employee, EmployeeStatus
from app.models.sync_log import SyncLog, SyncStatus

logger = logging.getLogger(__name__)

# Маппинг Redmine project identifier → название подразделения
DEPT_MAP = {
    "kpi-ruk": "Руководство",
    "kpi-org": "УП организационного обеспечения",
    "kpi-pra": "Правовое управление",
    "kpi-kza": "УП сопровождения корпоративных закупок",
    "kpi-zpd": "УП подготовки ЗИТ",
    "kpi-zpr": "УП проведения, мониторинга и аналитики ЗИТ",
    "kpi-tsr": "УП цифровой трансформации",
    "kpi-feo": "УП методологии развития ЕАСУЗ",
    "kpi-iaa": "УП анализа и автоматизации данных",
}

KPI_PROJECTS = list(DEPT_MAP.keys())

# ID кастомных полей пользователя в Redmine
KPI_ROLE_CF_ID = 211
TELEGRAM_CF_ID = 3


def _extract_cf(user_data: dict, cf_id: int) -> Optional[str]:
    """Извлекает значение кастомного поля пользователя по ID."""
    for cf in user_data.get("custom_fields", []):
        if cf.get("id") == cf_id:
            value = cf.get("value")
            return value if value else None
    return None


def _extract_department_from_memberships(memberships: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """
    Определяет подразделение сотрудника из его членства в KPI-проектах.
    Возвращает (department_code, department_name).
    """
    for m in memberships:
        project = m.get("project", {})
        identifier = project.get("identifier", "")
        if identifier in DEPT_MAP:
            return identifier, DEPT_MAP[identifier]
    return None, None


class SyncService:

    async def sync_employees(self, db: AsyncSession) -> SyncLog:
        """
        Основной метод синхронизации сотрудников с Redmine.
        Алгоритм:
        1. Получить всех активных пользователей Redmine
        2. Для каждого проверить членство в KPI-проектах
        3. Если состоит — это KPI-сотрудник
        4. Создать или обновить запись в employees
        5. Тех кто пропал из Redmine — пометить dismissed
        """
        started_at = datetime.now(timezone.utc)
        log = SyncLog(
            sync_type="employees",
            status=SyncStatus.failed,
            started_at=started_at,
        )
        db.add(log)
        await db.commit()

        created = updated = dismissed = errors = 0
        details = []

        try:
            # Шаг 1: Получить всех пользователей Redmine
            logger.info("Синхронизация: получаем пользователей из Redmine...")
            redmine_users = await redmine_client.get_all_users()
            logger.info(f"Получено {len(redmine_users)} пользователей из Redmine")

            # Шаг 2: Собрать членства во всех KPI-проектах
            logger.info("Получаем членства в KPI-проектах...")
            kpi_member_ids: dict[str, tuple[str, str]] = {}  # redmine_id → (dept_code, dept_name)

            for project_code in KPI_PROJECTS:
                memberships = await redmine_client.get_project_memberships(project_code)
                for m in memberships:
                    if "user" in m:
                        uid = str(m["user"]["id"])
                        if uid not in kpi_member_ids:
                            kpi_member_ids[uid] = (project_code, DEPT_MAP[project_code])

            logger.info(f"Найдено {len(kpi_member_ids)} участников KPI-проектов")

            # Шаг 3: Получить текущих сотрудников из БД
            result = await db.execute(select(Employee))
            existing: dict[str, Employee] = {e.redmine_id: e for e in result.scalars().all()}

            # Шаг 4: Обработать каждого Redmine-пользователя
            processed_ids = set()

            for rm_user in redmine_users:
                uid = str(rm_user["id"])

                # Только KPI-участники
                if uid not in kpi_member_ids:
                    continue

                processed_ids.add(uid)
                dept_code, dept_name = kpi_member_ids[uid]

                try:
                    # Получить детали для кастомных полей
                    detail = await redmine_client.get_user_detail(rm_user["id"])
                    if not detail:
                        detail = rm_user

                    position_id = _extract_cf(detail, KPI_ROLE_CF_ID)
                    telegram_id = _extract_cf(detail, TELEGRAM_CF_ID)

                    if uid in existing:
                        # Обновить существующего
                        emp = existing[uid]
                        changed = []

                        if emp.login != rm_user.get("login"):
                            emp.login = rm_user.get("login", emp.login)
                            changed.append("login")
                        if emp.firstname != rm_user.get("firstname"):
                            emp.firstname = rm_user.get("firstname", emp.firstname)
                            changed.append("firstname")
                        if emp.lastname != rm_user.get("lastname"):
                            emp.lastname = rm_user.get("lastname", emp.lastname)
                            changed.append("lastname")
                        if emp.email != rm_user.get("mail"):
                            emp.email = rm_user.get("mail")
                            changed.append("email")
                        if emp.position_id != position_id:
                            old_pos = emp.position_id
                            emp.position_id = position_id
                            changed.append(f"position_id: {old_pos}→{position_id}")
                        if emp.department_code != dept_code:
                            emp.department_code = dept_code
                            emp.department_name = dept_name
                            changed.append(f"department: {dept_code}")
                        if emp.telegram_id != telegram_id:
                            emp.telegram_id = telegram_id
                            changed.append("telegram_id")
                        if emp.status == EmployeeStatus.dismissed:
                            emp.status = EmployeeStatus.active
                            emp.is_active = True
                            changed.append("restored")

                        emp.last_synced_at = datetime.now(timezone.utc)

                        if changed:
                            updated += 1
                            details.append({"action": "updated", "login": emp.login, "changes": changed})
                    else:
                        # Создать нового
                        emp = Employee(
                            redmine_id=uid,
                            login=rm_user.get("login", ""),
                            firstname=rm_user.get("firstname", ""),
                            lastname=rm_user.get("lastname", ""),
                            email=rm_user.get("mail"),
                            telegram_id=telegram_id,
                            position_id=position_id,
                            department_code=dept_code,
                            department_name=dept_name,
                            status=EmployeeStatus.active,
                            is_active=True,
                            last_synced_at=datetime.now(timezone.utc),
                        )
                        db.add(emp)
                        created += 1
                        details.append({"action": "created", "login": emp.login, "dept": dept_code})

                except Exception as e:
                    errors += 1
                    logger.error(f"Ошибка обработки пользователя {uid}: {e}")
                    details.append({"action": "error", "redmine_id": uid, "error": str(e)})

            # Шаг 5: Пометить уволенных (были в БД, нет в Redmine или вышли из KPI-проектов)
            for uid, emp in existing.items():
                if uid not in processed_ids and emp.status == EmployeeStatus.active:
                    emp.status = EmployeeStatus.dismissed
                    emp.is_active = False
                    dismissed += 1
                    details.append({"action": "dismissed", "login": emp.login})

            # Сохранить результат
            log.status = SyncStatus.success if errors == 0 else SyncStatus.partial
            log.total = len(processed_ids)
            log.created_count = created
            log.updated_count = updated
            log.dismissed_count = dismissed
            log.errors_count = errors
            log.details = details
            log.finished_at = datetime.now(timezone.utc)

            await db.commit()
            logger.info(f"Синхронизация завершена: +{created} обновлено:{updated} уволено:{dismissed} ошибок:{errors}")

        except Exception as e:
            logger.error(f"Критическая ошибка синхронизации: {e}")
            log.status = SyncStatus.failed
            log.details = [{"error": str(e)}]
            log.finished_at = datetime.now(timezone.utc)
            await db.commit()

        return log

sync_service = SyncService()
