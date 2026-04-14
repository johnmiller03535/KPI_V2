import logging
import os
from typing import Optional
import openpyxl

logger = logging.getLogger(__name__)

# Путь к файлу (лежит в /reference в репо, монтируем в контейнер)
KPI_MAPPING_PATH = os.environ.get(
    "KPI_MAPPING_PATH",
    "/app/reference/KPI_Mapping.xlsx"
)


class KpiMappingService:
    """
    Читает KPI_Mapping.xlsx и возвращает структуру KPI для конкретной должности.

    Лист KPI_Indicators:
    - role_id (col A)
    - indicator (col B) — название показателя
    - criterion (col C) — критерий оценки
    - weight (col D) — вес в %
    - formula_type (col E) — тип формулы
    - plan_value (col F)
    - cumulative (col G)

    Лист KPI_Roles:
    - role_id (col A)
    - unit (col B) — подразделение
    - role (col C) — название должности
    """

    def __init__(self):
        self._cache: dict = {}
        self._loaded = False

    def _load(self):
        if self._loaded:
            return
        try:
            wb = openpyxl.load_workbook(KPI_MAPPING_PATH, read_only=True, data_only=True)

            # Загрузить KPI_Roles
            roles_sheet = wb["KPI_Roles"]
            self._roles: dict[str, dict] = {}
            for row in roles_sheet.iter_rows(min_row=2, values_only=True):
                if row[0]:
                    self._roles[str(row[0])] = {
                        "role_id": str(row[0]),
                        "unit": str(row[1]) if row[1] else "",
                        "role": str(row[2]) if row[2] else "",
                    }

            # Загрузить KPI_Indicators
            indicators_sheet = wb["KPI_Indicators"]
            self._indicators: dict[str, list] = {}
            for row in indicators_sheet.iter_rows(min_row=2, values_only=True):
                if not row[0]:
                    continue
                role_id = str(row[0])
                try:
                    weight = float(row[3]) if row[3] is not None else 0
                except (ValueError, TypeError):
                    weight = 0
                indicator = {
                    "role_id": role_id,
                    "indicator": str(row[1]) if row[1] else "",
                    "criterion": str(row[2]) if row[2] else "",
                    "weight": weight,
                    "formula_type": str(row[4]) if row[4] else "binary_manual",
                    "plan_value": str(row[5]) if row[5] else "",
                    "cumulative": bool(row[6]) if row[6] else False,
                }
                if role_id not in self._indicators:
                    self._indicators[role_id] = []
                self._indicators[role_id].append(indicator)

            wb.close()
            self._loaded = True
            total_indicators = sum(len(v) for v in self._indicators.values())
            logger.info(
                f"KPI_Mapping загружен: {len(self._roles)} должностей, "
                f"{total_indicators} индикаторов"
            )
        except FileNotFoundError:
            logger.warning(f"KPI_Mapping.xlsx не найден по пути {KPI_MAPPING_PATH}")
            self._roles = {}
            self._indicators = {}
            self._loaded = True
        except Exception as e:
            logger.error(f"Ошибка загрузки KPI_Mapping: {e}")
            self._roles = {}
            self._indicators = {}

    def get_role_info(self, role_id: str) -> Optional[dict]:
        self._load()
        return self._roles.get(role_id)

    def get_kpi_for_role(self, role_id: str) -> list[dict]:
        """Возвращает список KPI-индикаторов для должности."""
        self._load()
        return self._indicators.get(role_id, [])

    def get_binary_auto_criteria(self, role_id: str) -> list[str]:
        """Возвращает список критериев с formula_type=binary_auto (для AI-саммари)."""
        kpis = self.get_kpi_for_role(role_id)
        criteria = []
        for kpi in kpis:
            if kpi["formula_type"] == "binary_auto":
                # criterion может содержать несколько через ' | '
                for c in kpi["criterion"].split(" | "):
                    c = c.strip()
                    if c:
                        criteria.append(c)
        return criteria

    def get_numeric_kpis(self, role_id: str) -> list[dict]:
        """Возвращает KPI, требующие ручного ввода числовых значений."""
        kpis = self.get_kpi_for_role(role_id)
        numeric_types = {"threshold", "multi_threshold", "quarterly_threshold",
                         "productivity", "count_min"}
        return [k for k in kpis if k["formula_type"] in numeric_types]

    def get_all_roles(self) -> list[dict]:
        self._load()
        return list(self._roles.values())


kpi_mapping_service = KpiMappingService()
