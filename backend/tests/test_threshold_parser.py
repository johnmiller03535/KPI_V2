import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.services.threshold_parser import (
    parse_thresholds,
    apply_threshold,
    evaluate_threshold_kpi,
)


class TestParseThresholds:
    def test_simple_threshold(self):
        rules = parse_thresholds(">=90%→100% | <90%→0%")
        assert len(rules) == 2
        assert rules[0].score == 100.0
        assert rules[1].score == 0.0

    def test_multi_threshold(self):
        rules = parse_thresholds(">=67%→100% | <67%, >50%→50% | <50%→0%")
        assert len(rules) == 3
        assert rules[1].score == 50.0
        assert len(rules[1].conditions) == 2

    def test_empty_string(self):
        assert parse_thresholds("") == []
        assert parse_thresholds("   ") == []


class TestApplyThreshold:
    def test_threshold_pass(self):
        rules = parse_thresholds(">=90%→100% | <90%→0%")
        assert apply_threshold(95, rules) == 100.0

    def test_threshold_fail(self):
        rules = parse_thresholds(">=90%→100% | <90%→0%")
        assert apply_threshold(85, rules) == 0.0

    def test_threshold_exact(self):
        rules = parse_thresholds(">=90%→100% | <90%→0%")
        assert apply_threshold(90, rules) == 100.0

    def test_multi_threshold_high(self):
        rules = parse_thresholds(">=67%→100% | <67%, >50%→50% | <50%→0%")
        assert apply_threshold(70, rules) == 100.0

    def test_multi_threshold_mid(self):
        rules = parse_thresholds(">=67%→100% | <67%, >50%→50% | <50%→0%")
        assert apply_threshold(60, rules) == 50.0

    def test_multi_threshold_low(self):
        rules = parse_thresholds(">=67%→100% | <67%, >50%→50% | <50%→0%")
        assert apply_threshold(40, rules) == 0.0

    def test_boundary_67(self):
        rules = parse_thresholds(">=67%→100% | <67%, >50%→50% | <50%→0%")
        assert apply_threshold(67, rules) == 100.0

    def test_boundary_50(self):
        rules = parse_thresholds(">=67%→100% | <67%, >50%→50% | <50%→0%")
        assert apply_threshold(50, rules) == 0.0

    def test_fraction_input(self):
        """Значение как доля (0.92) должно нормализоваться в 92%."""
        rules = parse_thresholds(">=90%→100% | <90%→0%")
        assert apply_threshold(0.92, rules) == 100.0
        assert apply_threshold(0.85, rules) == 0.0

    def test_no_match_returns_zero(self):
        rules = parse_thresholds(">=90%→100%")
        assert apply_threshold(50, rules) == 0.0


class TestEvaluateThresholdKpi:
    def test_threshold_type(self):
        assert evaluate_threshold_kpi("threshold", ">=90%→100% | <90%→0%", 95) == 100.0
        assert evaluate_threshold_kpi("threshold", ">=90%→100% | <90%→0%", 80) == 0.0

    def test_multi_threshold_type(self):
        thresholds = ">=67%→100% | <67%, >50%→50% | <50%→0%"
        assert evaluate_threshold_kpi("multi_threshold", thresholds, 70) == 100.0
        assert evaluate_threshold_kpi("multi_threshold", thresholds, 60) == 50.0
        assert evaluate_threshold_kpi("multi_threshold", thresholds, 40) == 0.0

    def test_quarterly_threshold(self):
        # Q1 и Q2 с разными порогами
        thresholds = ">=80%→100% | <80%→0% || >=85%→100% | <85%→0%"
        assert evaluate_threshold_kpi("quarterly_threshold", thresholds, 82, quarter=1) == 100.0
        assert evaluate_threshold_kpi("quarterly_threshold", thresholds, 82, quarter=2) == 0.0
        assert evaluate_threshold_kpi("quarterly_threshold", thresholds, 90, quarter=2) == 100.0

    def test_quarterly_no_quarter_uses_last(self):
        thresholds = ">=80%→100% | <80%→0% || >=85%→100% | <85%→0%"
        # без quarter → последний блок
        assert evaluate_threshold_kpi("quarterly_threshold", thresholds, 90) == 100.0
