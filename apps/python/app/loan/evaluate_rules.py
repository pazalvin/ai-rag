import math

from pydantic import Field

from app.loan.load_rules import load_loan_rules
from app.loan.rules_schema import IncomeBand, LoanRules
from app.models import CamelModel, js_num, to_fixed
from app.schemas import LoanApplication


class RuleCheckResult(CamelModel):
    eligible: bool
    reasons: list[str]
    matched_rules: list[str] = Field(alias="matched_rules")
    rules_version: str | None = None


def evaluate_rules(app: LoanApplication, rules: LoanRules | None = None) -> RuleCheckResult:
    """
    Deterministic underwriting against configurable rules (data/rules/loan-rules.json).
    Pass `rules` to override; otherwise the JSON file is loaded (hot-reloads on change).
    """
    rules = rules or load_loan_rules()
    reasons: list[str] = []
    matched: list[str] = []
    allowed = {s.lower() for s in rules.allowed_employment_statuses}

    matched.append("Eligibility age")
    if app.age < rules.age.min or app.age > rules.age.max:
        reasons.append(f"Age {app.age} is outside {rules.age.min}–{rules.age.max}.")

    matched.append("Employment status")
    if app.employment_status not in allowed:
        reasons.append(f'Employment status "{app.employment_status}" is not accepted.')

    matched.append("Work tenure")
    tenure_reason = _check_tenure(app, rules, allowed)
    if tenure_reason:
        reasons.append(tenure_reason)

    matched.append("Income floor")
    if app.monthly_income < rules.income_floor_monthly:
        reasons.append(
            f"Monthly income {app.monthly_income} is below the "
            f"{js_num(rules.income_floor_monthly)} floor."
        )

    matched.append("Income capacity vs loan amount")
    band = _required_income_band(app.loan_amount, rules)
    if app.monthly_income < band.min_monthly_income:
        reasons.append(
            f"Monthly income {app.monthly_income} is below {js_num(band.min_monthly_income)} "
            f"required for loan amount {app.loan_amount} ({band.label})."
        )

    matched.append("Maximum loan amount and term")
    if app.loan_amount > rules.max_loan_amount:
        reasons.append(
            f"Loan amount {app.loan_amount} exceeds maximum {js_num(rules.max_loan_amount)}."
        )
    term = rules.loan_term_months
    if app.loan_term_months < term.min or app.loan_term_months > term.max:
        reasons.append(
            f"Loan term {app.loan_term_months} months is outside {term.min}–{term.max} months."
        )

    matched.append("Installment affordability")
    if app.loan_term_months > 0:
        installment = app.loan_amount / app.loan_term_months
        max_installment = app.monthly_income * rules.max_installment_to_income_ratio
        if installment > max_installment:
            reasons.append(
                f"Estimated installment {to_fixed(installment, 0)} exceeds "
                f"{js_num(rules.max_installment_to_income_ratio * 100)}% of monthly income "
                f"({to_fixed(max_installment, 0)})."
            )

    matched.append("Credit score bands")
    decline_below = rules.credit_score.decline_below
    restricted = rules.credit_score.restricted_band
    if app.credit_score < decline_below:
        reasons.append(f"Credit score {app.credit_score} is below {decline_below}.")
    elif restricted.min <= app.credit_score <= restricted.max:
        dti_strict = (
            (app.existing_debt + app.loan_amount) / (app.monthly_income * 12)
            if app.monthly_income > 0
            else math.inf
        )
        if dti_strict >= restricted.max_dti or app.loan_amount > restricted.max_loan_amount:
            reasons.append(
                f"Credit score {app.credit_score} ({restricted.min}–{restricted.max}) requires "
                f"DTI under {js_num(restricted.max_dti * 100)}% and loan amount at most "
                f"{js_num(restricted.max_loan_amount)}."
            )

    matched.append("Debt-to-income (DTI)")
    if app.monthly_income > 0:
        dti = (app.existing_debt + app.loan_amount) / (app.monthly_income * 12)
        if dti > rules.max_dti:
            reasons.append(
                f"DTI {to_fixed(dti * 100, 1)}% exceeds the maximum {js_num(rules.max_dti * 100)}%."
            )

    return RuleCheckResult(
        eligible=not reasons,
        reasons=reasons or ["All deterministic guideline checks passed."],
        matched_rules=matched,
        rules_version=rules.version,
    )


def _required_income_band(loan_amount: int, rules: LoanRules) -> IncomeBand:
    bands = sorted(rules.income_bands, key=lambda b: b.max_loan_amount)
    for band in bands:
        if loan_amount <= band.max_loan_amount:
            return band
    return bands[-1]


def _check_tenure(app: LoanApplication, rules: LoanRules, allowed: set[str]) -> str | None:
    """Return a failure reason, or None when tenure is sufficient."""
    status = app.employment_status
    if status not in allowed:
        return None

    requirement = rules.tenure.by_employment_status.get(status)
    if requirement is None:
        return f'No tenure rule configured for employment status "{status}".'

    needed = (
        requirement.above_threshold_months
        if app.loan_amount > rules.tenure.loan_amount_threshold
        else requirement.at_or_below_threshold_months
    )
    if app.months_employed < needed:
        return (
            f"Work tenure {app.months_employed} months is below {needed} months required "
            f"for loan {app.loan_amount} ({status})."
        )
    return None
