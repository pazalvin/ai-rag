import re

from app.loan.evaluate_rules import evaluate_rules
from app.loan.load_rules import load_loan_rules


def test_strong_applicant_is_fit(jane):
    result = evaluate_rules(jane)
    assert result.eligible is True
    assert result.rules_version


def test_rejects_income_below_band(jane):
    result = evaluate_rules(
        jane.model_copy(update={"full_name": "Low Income Leo", "monthly_income": 22000})
    )
    assert result.eligible is False
    assert any(re.search(r"below 40000", r, re.I) for r in result.reasons)


def test_rejects_short_tenure(jane):
    result = evaluate_rules(
        jane.model_copy(update={"months_employed": 3, "loan_amount": 180000})
    )
    assert result.eligible is False
    assert any(re.search(r"tenure", r, re.I) for r in result.reasons)


def test_rejects_unemployed(jane):
    result = evaluate_rules(
        jane.model_copy(
            update={
                "employment_status": "unemployed",
                "monthly_income": 0,
                "months_employed": 0,
                "loan_amount": 50000,
                "existing_debt": 0,
            }
        )
    )
    assert result.eligible is False
    assert any(re.search(r"unemployed", r, re.I) for r in result.reasons)


def test_in_memory_rules_override(jane):
    rules = load_loan_rules().model_copy(
        update={"version": "test-override", "income_floor_monthly": 100_000}
    )
    result = evaluate_rules(jane, rules)
    assert result.eligible is False
    assert result.rules_version == "test-override"
    assert any(re.search(r"100000 floor", r, re.I) for r in result.reasons)
