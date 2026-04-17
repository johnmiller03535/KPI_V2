from pydantic import BaseModel
from typing import Literal


KpiFormulaType = Literal[
    "binary_auto",
    "binary_manual",
    "threshold",
    "multi_threshold",
    "quarterly_threshold",
]

KpiType = Literal["binary_auto", "binary_manual", "numeric"]


class KpiItem(BaseModel):
    pos_id: int
    role_id: str
    indicator: str
    criterion: str
    plan_value: str
    weight: int
    is_common: bool
    formula_type: KpiFormulaType
    formula_desc: str
    thresholds: str
    cumulative: bool
    kpi_type: KpiType


class KpiStructure(BaseModel):
    role_id: str
    binary_auto: list[KpiItem]
    binary_manual: list[KpiItem]
    numeric: list[KpiItem]
    total_weight: int
