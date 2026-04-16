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

    Реальная структура файла:
    {
      "evaluator":  {"position_id": "evaluator_position_id" | null, ...},
      "deputy_for": {"position_id": "deputy_position_id", ...},
      "ruk_assignments": {...}
    }
    Значение null → должность подчиняется директору, вне зоны системы.
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

    def get_evaluator_position(self, position_id: str) -> Optional[str]:
        """Возвращает position_id руководителя. None если директорский уровень."""
        self._load()
        return self._data.get("evaluator", {}).get(position_id)

    def get_deputy_position(self, position_id: str) -> Optional[str]:
        """Возвращает position_id заместителя для данной должности."""
        self._load()
        return self._data.get("deputy_for", {}).get(position_id)

    def get_subordinates(self, manager_position_id: str) -> list[str]:
        """Список position_id прямых подчинённых руководителя."""
        self._load()
        return [
            pos for pos, ev in self._data.get("evaluator", {}).items()
            if ev == manager_position_id
        ]

    def is_manager_of(self, manager_position_id: str, employee_position_id: str) -> bool:
        return self.get_evaluator_position(employee_position_id) == manager_position_id


subordination_service = SubordinationService()
