import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

SUBORDINATION_PATH = os.environ.get(
    "SUBORDINATION_PATH",
    "/app/reference/subordination.json"
)


class SubordinationService:
    """
    Читает subordination.json и определяет цепочки подчинения.

    subordination.json использует unit-коды ('РУК_ПЕР3_001'), а employees.position_id
    хранит числовой role_id ('1'). _to_unit() конвертирует числовой id → unit через
    KPI_Mapping перед обращением к картам.
    """

    def __init__(self):
        self._data: dict = {}
        self._loaded = False

    def _load(self):
        if self._loaded:
            return
        try:
            with open(SUBORDINATION_PATH, "r", encoding="utf-8") as f:
                self._data = json.load(f)
            self._loaded = True
            count = len(self._data.get("evaluator", {}))
            logger.info(f"Subordination загружен: {count} записей в evaluator")
        except FileNotFoundError:
            logger.warning(f"subordination.json не найден: {SUBORDINATION_PATH}")
            self._data = {}
            self._loaded = True
        except Exception as e:
            logger.error(f"Ошибка загрузки subordination.json: {e}")
            self._data = {}

    def _to_unit(self, position_id: str) -> str:
        """Конвертирует числовой position_id ('4') → role_id ('РУК_ЗАМД_004').
        subordination.json использует role_id в качестве ключей."""
        if not position_id or not str(position_id).isdigit():
            return position_id
        from app.services.kpi_mapping_service import kpi_mapping_service
        role_info = kpi_mapping_service.get_role_info(str(position_id))
        if role_info:
            return role_info["role_id"]
        return position_id

    def get_evaluator_position(self, position_id: str) -> Optional[str]:
        """Возвращает unit руководителя. None если директорский уровень."""
        self._load()
        unit = self._to_unit(str(position_id))
        return self._data.get("evaluator", {}).get(unit)

    def get_deputy_position(self, position_id: str) -> Optional[str]:
        """Возвращает unit заместителя для данной должности."""
        self._load()
        unit = self._to_unit(str(position_id))
        return self._data.get("deputy_for", {}).get(unit)

    def get_subordinates(self, manager_position_id: str) -> list[str]:
        """Список role_id прямых подчинённых руководителя.
        Возвращает role_id строки ('ЦТР_НАЧ_071') — в review.py они
        конвертируются в pos_id через kpi_mapping_service."""
        self._load()
        manager_unit = self._to_unit(str(manager_position_id))
        evaluator_map = self._data.get("evaluator", {})
        return [
            u for u, evaluator in evaluator_map.items()
            if evaluator == manager_unit
        ]

    def is_manager_of(self, manager_position_id: str, employee_position_id: str) -> bool:
        evaluator = self.get_evaluator_position(str(employee_position_id))
        if not evaluator:
            return False
        manager_unit = self._to_unit(str(manager_position_id))
        return evaluator == manager_unit

    def get_all_managers(self) -> list[str]:
        """Возвращает отсортированный список role_id, которые являются чьим-то руководителем."""
        self._load()
        managers = {v for v in self._data.get("evaluator", {}).values() if v}
        return sorted(managers)

    def reload(self):
        """Сбрасывает кэш и перечитывает subordination.json."""
        self._loaded = False
        self._data = {}
        self._load()

    def write_evaluator(self, role_id: str, evaluator_role_id: Optional[str]):
        """Обновляет evaluator в subordination.json и перезагружает сервис."""
        self._load()
        evaluator_map = self._data.get("evaluator", {})
        if role_id not in evaluator_map:
            raise ValueError(f"role_id '{role_id}' не найден в subordination.json")
        evaluator_map[role_id] = evaluator_role_id
        self._data["evaluator"] = evaluator_map
        with open(SUBORDINATION_PATH, "w", encoding="utf-8") as f:
            import json as _json
            _json.dump(self._data, f, ensure_ascii=False, indent=2)
        self.reload()


subordination_service = SubordinationService()
