"""
Сервис импорта иерархии подчинения из Excel-выгрузки Redmine People плагина.

Файл кладётся в reference/people_export.xlsx (или docs/).
Сервис читает его, сопоставляет redmine_id → position_id через таблицу employees,
конвертирует pos_id → role_id через KPI_Mapping и перезаписывает subordination.json.
"""
import logging
from pathlib import Path
from typing import Optional

import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee, EmployeeStatus
from app.services.kpi_mapping_service import kpi_mapping_service
from app.services.subordination_service import subordination_service

logger = logging.getLogger(__name__)

# Ищем файл в нескольких местах
_SEARCH_PATHS = [
    Path("/app/reference/people_export.xlsx"),
    Path("reference/people_export.xlsx"),
    Path("docs/people_export.xlsx"),
]


def _find_export_file() -> Optional[Path]:
    """Найти файл выгрузки People. Принимает любой .xlsx в reference/ или docs/ с 'people' в имени."""
    for p in _SEARCH_PATHS:
        if p.exists():
            return p
    # Поиск по маске
    for directory in [Path("/app/reference"), Path("reference"), Path("docs")]:
        if directory.exists():
            matches = list(directory.glob("people*.xlsx")) + list(directory.glob("*people*.xlsx"))
            if matches:
                return sorted(matches)[-1]  # последний по алфавиту/дате
    return None


def _read_export(path: Path) -> list[dict]:
    """
    Читает Excel-файл выгрузки People.
    Ожидаемые колонки (по позиции):
      0: ID, 1: Пользователь (логин), 2: ФИО, 3: Менеджер ID, 4: Менеджер, ...
    Возвращает список dict с ключами: emp_id, login, name, manager_id, manager_name.
    """
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    headers = [str(c).strip() if c else "" for c in next(rows_iter)]

    # Определяем индексы по заголовкам
    def idx(name: str) -> int:
        for i, h in enumerate(headers):
            if name.lower() in h.lower():
                return i
        return -1

    i_id = idx("id") if idx("id") != -1 else 0
    i_login = idx("пользователь") if idx("пользователь") != -1 else 1
    i_name = idx("фио") if idx("фио") != -1 else 2
    i_mgr_id = idx("менеджер id") if idx("менеджер id") != -1 else 3
    i_mgr_name = idx("менеджер") if idx("менеджер") != -1 else 4

    result = []
    for row in rows_iter:
        emp_id = str(row[i_id]).strip() if row[i_id] is not None else ""
        if not emp_id or emp_id == "None":
            continue
        mgr_id = str(row[i_mgr_id]).strip() if row[i_mgr_id] is not None else ""
        result.append({
            "emp_id": emp_id,
            "login": str(row[i_login] or "").strip(),
            "name": str(row[i_name] or "").strip(),
            "manager_id": mgr_id if mgr_id and mgr_id != "None" else None,
            "manager_name": str(row[i_mgr_name] or "").strip(),
        })

    wb.close()
    return result


async def rebuild_subordination_from_people_export(db: AsyncSession) -> dict:
    """
    Основная функция. Читает People Excel, строит subordination.json.

    Возвращает статистику:
      {
        "file": str,
        "people_rows": int,
        "matched_employees": int,
        "mapped_pairs": int,
        "skipped_no_position": int,
        "skipped_external_manager": int,
        "top_level": int,
        "errors": [str],
      }
    """
    stats: dict = {
        "file": None,
        "people_rows": 0,
        "matched_employees": 0,
        "mapped_pairs": 0,
        "skipped_no_position": 0,
        "skipped_external_manager": 0,
        "top_level": 0,
        "errors": [],
    }

    # 1. Найти файл
    export_path = _find_export_file()
    if not export_path:
        stats["errors"].append("Файл people_export.xlsx не найден. Положите его в reference/ или docs/")
        return stats
    stats["file"] = str(export_path)
    logger.info(f"PeopleImport: читаем {export_path}")

    # 2. Прочитать Excel
    try:
        people_rows = _read_export(export_path)
    except Exception as e:
        stats["errors"].append(f"Ошибка чтения файла: {e}")
        return stats
    stats["people_rows"] = len(people_rows)

    # 3. Загрузить employees из БД → redmine_id → position_id
    result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.active)
    )
    employees = result.scalars().all()
    emp_pos_map: dict[str, str] = {}  # redmine_id (str) → position_id (str)
    for e in employees:
        if e.position_id:
            emp_pos_map[str(e.redmine_id)] = str(e.position_id)

    # Также индекс логинов для диагностики
    emp_login_map: dict[str, str] = {str(e.redmine_id): e.login for e in employees}

    # 4. Все redmine_id из People export
    people_ids = {r["emp_id"] for r in people_rows}

    # 5. Строим маппинг: emp_role_id → evaluator_role_id
    new_evaluator: dict[str, Optional[str]] = {}

    for row in people_rows:
        emp_id = row["emp_id"]

        # a. Получить position_id сотрудника
        pos_id = emp_pos_map.get(emp_id)
        if not pos_id:
            logger.debug(f"PeopleImport: {emp_id} ({row['login']}) — нет position_id, пропуск")
            stats["skipped_no_position"] += 1
            continue

        stats["matched_employees"] += 1

        # b. Конвертировать pos_id → role_id
        role_id = kpi_mapping_service.pos_id_to_role_id(pos_id)
        if not role_id:
            logger.debug(f"PeopleImport: pos_id={pos_id} не найден в KPI_Mapping, пропуск")
            stats["skipped_no_position"] += 1
            stats["matched_employees"] -= 1
            continue

        # c. Определить руководителя
        mgr_id = row["manager_id"]
        evaluator_role_id: Optional[str] = None

        if mgr_id and mgr_id in people_ids:
            mgr_pos_id = emp_pos_map.get(mgr_id)
            if mgr_pos_id:
                evaluator_role_id = kpi_mapping_service.pos_id_to_role_id(mgr_pos_id)
                if not evaluator_role_id:
                    logger.debug(f"PeopleImport: manager pos_id={mgr_pos_id} не в KPI_Mapping")
                    stats["skipped_external_manager"] += 1
            else:
                # Менеджер есть в People, но нет в employees (нет КПИ_Номер)
                logger.debug(f"PeopleImport: manager {mgr_id} ({row['manager_name']}) — нет position_id")
                stats["skipped_external_manager"] += 1
        elif mgr_id:
            # Менеджер вне организации (внешний, комитет и т.д.)
            stats["skipped_external_manager"] += 1
        else:
            stats["top_level"] += 1

        new_evaluator[role_id] = evaluator_role_id
        stats["mapped_pairs"] += 1

    # 6. Дополнить ролями из KPI_Mapping которых нет в People export
    # (чтобы не потерять роли без сотрудников)
    all_roles = kpi_mapping_service.get_all_roles()
    current_data = subordination_service._data or {}
    old_evaluator = current_data.get("evaluator", {})

    added_missing = 0
    for role_info in all_roles:
        rid = role_info["role_id"]
        if rid not in new_evaluator:
            # Сохраняем старое значение если было
            new_evaluator[rid] = old_evaluator.get(rid)
            added_missing += 1

    logger.info(
        f"PeopleImport: {stats['mapped_pairs']} пар из People, "
        f"{added_missing} ролей без сотрудников (старые значения), "
        f"пропущено без position: {stats['skipped_no_position']}, "
        f"внешние менеджеры: {stats['skipped_external_manager']}"
    )

    # 7. Сохранить subordination.json
    try:
        subordination_service._load()
        data = dict(subordination_service._data)
        data["evaluator"] = new_evaluator
        subordination_service._data = data
        # Пишем в файл так же, как write_evaluator
        import json as _json
        from app.services.subordination_service import SUBORDINATION_PATH
        with open(SUBORDINATION_PATH, "w", encoding="utf-8") as f:
            _json.dump(data, f, ensure_ascii=False, indent=2)
        subordination_service.reload()
    except Exception as e:
        stats["errors"].append(f"Ошибка записи subordination.json: {e}")
        return stats

    return stats
