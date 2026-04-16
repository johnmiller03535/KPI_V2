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
    Читает subordination.json и определяет:
    - кто является оценщиком (evaluator) для данного position_id
    - кто является заместителем (deputy)

    Реальная структура subordination.json:
    {
      "evaluator":  {"ЗПД_КОН_056": "ЗПД_ЗАМ_НАЧ_ОТД_054", ...},
      "deputy_for": {"ЗПД_ЗАМ_НАЧ_ОТД_054": "ЗПД_ЗАМ_056_ALT", ...},
      "ruk_assignments": {...}
    }
    Значение null в "evaluator" означает, что должность подчиняется директору
    и вне зоны действия бота.
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
            evaluator_count = len(self._data.get("evaluator", {}))
            logger.info(f"Subordination загружен: {evaluator_count} записей в evaluator")
        except FileNotFoundError:
            logger.warning(f"subordination.json не найден: {SUBORDINATION_PATH}")
            self._data = {}
            self._loaded = True
        except Exception as e:
            logger.error(f"Ошибка загрузки subordination.json: {e}")
            self._data = {}

    def get_evaluator_position(self, position_id: str) -> Optional[str]:
        """
        Возвращает position_id руководителя для данной должности.
        None если должность подчиняется директору или не найдена.
        """
        self._load()
        return self._data.get("evaluator", {}).get(position_id)

    def get_deputy_position(self, position_id: str) -> Optional[str]:
        """Возвращает position_id заместителя для данной должности."""
        self._load()
        return self._data.get("deputy_for", {}).get(position_id)

    def get_subordinates(self, manager_position_id: str) -> list[str]:
        """
        Возвращает список position_id всех прямых подчинённых руководителя.
        Исключает должности с null-оценщиком (директорский уровень).
        """
        self._load()
        evaluator_map = self._data.get("evaluator", {})
        return [
            pos_id for pos_id, evaluator in evaluator_map.items()
            if evaluator == manager_position_id
        ]

    def is_manager_of(self, manager_position_id: str, employee_position_id: str) -> bool:
        """Проверяет, является ли manager_position_id руководителем employee_position_id."""
        evaluator = self.get_evaluator_position(employee_position_id)
        return evaluator == manager_position_id

    def get_all_evaluators(self) -> dict[str, Optional[str]]:
        """Возвращает всю карту evaluator (position_id → evaluator_position_id)."""
        self._load()
        return dict(self._data.get("evaluator", {}))


subordination_service = SubordinationService()
