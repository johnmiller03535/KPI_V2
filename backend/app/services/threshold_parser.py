"""
Парсер пороговых правил для KPI-оценки.

Формат строки правил:
  ">=67%→100% | <67%, >50%→50% | <50%→0%"

Разделитель блоков: " | "
Разделитель условие→результат: "→"
Несколько условий в блоке (через запятую): все должны выполняться (AND).
"""

import re
from typing import Optional
from pydantic import BaseModel


class ThresholdRule(BaseModel):
    conditions: list[str]  # [">=67%", ">50%"]
    score: float           # 100.0 / 50.0 / 0.0


def _parse_percent(value_str: str) -> float:
    """'92%' → 92.0, '92' → 92.0"""
    s = value_str.strip().rstrip("%")
    return float(s)


def _eval_condition(value: float, condition: str) -> bool:
    """Вычисляет одно условие вида '>=67%', '<50%', '==100' и т.д."""
    condition = condition.strip()
    m = re.match(r"^(>=|<=|>|<|==)\s*(\d+(?:\.\d+)?)\s*%?$", condition)
    if not m:
        return False
    op, threshold_str = m.group(1), m.group(2)
    threshold = float(threshold_str)
    ops = {
        ">=": value >= threshold,
        "<=": value <= threshold,
        ">":  value > threshold,
        "<":  value < threshold,
        "==": value == threshold,
    }
    return ops[op]


def parse_thresholds(thresholds_str: str) -> list[ThresholdRule]:
    """
    Парсит строку вида '>=67%→100% | <67%, >50%→50% | <50%→0%'
    в список ThresholdRule.
    """
    if not thresholds_str or not thresholds_str.strip():
        return []

    rules: list[ThresholdRule] = []
    blocks = thresholds_str.split("|")

    for block in blocks:
        block = block.strip()
        if "→" not in block:
            continue
        left, right = block.split("→", 1)
        score_str = right.strip().rstrip("%")
        try:
            score = float(score_str)
        except ValueError:
            continue

        conditions = [c.strip() for c in left.split(",") if c.strip()]
        if conditions:
            rules.append(ThresholdRule(conditions=conditions, score=score))

    return rules


def apply_threshold(value: float, rules: list[ThresholdRule]) -> float:
    """
    Применяет список правил к значению.
    Возвращает score первого совпавшего правила, иначе 0.
    value может быть как 0.92 (доля) так и 92 (процент) — нормализуем до процентов.
    """
    # Нормализация: если значение <= 1.0 (доля), переводим в проценты
    normalized = value * 100 if value <= 1.0 else value

    for rule in rules:
        if all(_eval_condition(normalized, cond) for cond in rule.conditions):
            return rule.score
    return 0.0


def evaluate_threshold_kpi(
    formula_type: str,
    thresholds_str: str,
    fact_value: float,
    quarter: Optional[int] = None,
) -> float:
    """
    Главная функция оценки числового KPI.

    formula_type:
      - "threshold"           — одно пороговое значение
      - "multi_threshold"     — несколько ступеней
      - "quarterly_threshold" — разные пороги по кварталам (блоки через " || ")

    Возвращает score (0.0, 50.0, 100.0 и т.д.)
    """
    if formula_type == "quarterly_threshold" and quarter is not None:
        # Формат: "Q1: >=80%→100% | <80%→0% || Q2: >=85%→100% | <85%→0% || ..."
        # Или просто блоки через "||" без меток квартала
        quarter_blocks = thresholds_str.split("||")
        idx = quarter - 1
        if 0 <= idx < len(quarter_blocks):
            block = quarter_blocks[idx].strip()
            # Убираем метку "Q1:" если есть
            if re.match(r"^Q\d\s*:", block):
                block = re.sub(r"^Q\d\s*:\s*", "", block)
            rules = parse_thresholds(block)
            return apply_threshold(fact_value, rules)
        # Если квартал не найден — используем последний блок
        rules = parse_thresholds(quarter_blocks[-1].strip())
        return apply_threshold(fact_value, rules)

    rules = parse_thresholds(thresholds_str)
    return apply_threshold(fact_value, rules)
