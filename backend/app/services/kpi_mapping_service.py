"""
KPI Mapping Service.
Разбирает position_id (напр. «ЕАС_КОН_026») и возвращает
человекочитаемое название роли и подразделения.

Формат position_id:  DEPT_TYPE[_SUBTYPE]_NNN
  DEPT  — код подразделения (ОРГ, ЕАС, ПРА, КЗА, ЗПД, ЗПР, ЦТР, ААД, РУК)
  TYPE  — тип должности (КОН, ГСП, ВЕД, ГАН, НАЧ, ЗАМ, …)
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Коды подразделений → читаемые названия
DEPT_NAMES: dict[str, str] = {
    "ОРГ": "Управление организационной работы",
    "ЕАС": "Управление ЕАС",
    "ПРА": "Правовое управление",
    "КЗА": "Управление контрактов и закупок",
    "ЗПД": "Управление ЗПД",
    "ЗПР": "Управление ЗПР",
    "ЦТР": "Управление ЦТР",
    "ААД": "Управление АА и документооборота",
    "РУК": "Руководство",
}

# Паттерны должностей (часть position_id после кода подразделения)
# Проверяются в порядке от более специфичного к менее специфичному
ROLE_PATTERNS: list[tuple[str, str]] = [
    ("_ЗАМ_НАЧ_ОТД_", "Заместитель начальника отдела"),
    ("_НАЧ_ОТД_",     "Начальник отдела"),
    ("_ЗАМ_ОТД_",     "Заместитель начальника отдела"),
    ("_НАЧ_",         "Начальник управления"),
    ("_ЗАМ_",         "Заместитель начальника управления"),
    ("_КОН_",         "Консультант"),
    ("_ГСП_",         "Главный специалист"),
    ("_ВЕД_",         "Ведущий специалист"),
    ("_ГАН_",         "Главный аналитик"),
    ("_ПЕРЗ_",        "Первый заместитель директора"),
    ("_ЗАМД_",        "Заместитель директора"),
]


class KpiMappingService:
    """
    Сервис для получения метаданных должности по position_id.
    Не требует внешних файлов — вся логика основана на кодировке position_id.
    """

    def get_role_info(self, position_id: Optional[str]) -> Optional[dict]:
        """
        Возвращает {role, department, department_code} или None.

        >>> svc = KpiMappingService()
        >>> svc.get_role_info("ЕАС_КОН_026")
        {'role': 'Консультант', 'department': 'Управление ЕАС', 'department_code': 'ЕАС'}
        """
        if not position_id:
            return None

        dept_code = position_id.split("_")[0]
        dept_name = DEPT_NAMES.get(dept_code, dept_code)
        role_name = self._detect_role(position_id)

        return {
            "role": role_name,
            "department": dept_name,
            "department_code": dept_code,
        }

    def _detect_role(self, position_id: str) -> str:
        upper = position_id.upper()
        for pattern, label in ROLE_PATTERNS:
            if pattern in upper:
                return label
        return position_id  # fallback — возвращаем сам ID

    def get_department_name(self, position_id: Optional[str]) -> Optional[str]:
        info = self.get_role_info(position_id)
        return info["department"] if info else None

    def get_role_name(self, position_id: Optional[str]) -> Optional[str]:
        info = self.get_role_info(position_id)
        return info["role"] if info else None


kpi_mapping_service = KpiMappingService()
