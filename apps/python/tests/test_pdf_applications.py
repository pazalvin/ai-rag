import pytest

from app.loan.check_eligibility import check_eligibility
from app.loan.evaluate_rules import evaluate_rules
from app.loan.parse_applicant_pdf import parse_applicant_pdf, parse_applicant_text
from tests.conftest import APPLICATIONS_DIR, fixture_pdf, run


def test_parse_applicant_text():
    app = parse_applicant_text(
        """
Full Name: Alex Rivera
Age: 40
Monthly Income: 60000
Employment Status: employed
Months Employed: 24
Loan Amount: 250000
Loan Term Months: 48
Credit Score: 740
Existing Debt: 20000
"""
    )
    assert app.full_name == "Alex Rivera"
    assert app.monthly_income == 60000
    assert app.loan_amount == 250000


@pytest.mark.parametrize(
    ("file", "expect_fit", "name"),
    [
        ("eligible-jane-doe.pdf", True, "Jane Doe"),
        ("ineligible-low-income.pdf", False, "Low Income Leo"),
        ("ineligible-short-tenure.pdf", False, "Short Tenure Sam"),
        ("ineligible-unemployed.pdf", False, "Unemployed Uma"),
    ],
)
def test_pdf_application_fit(file, expect_fit, name):
    application, _ = parse_applicant_pdf(fixture_pdf(APPLICATIONS_DIR, file))
    assert application.full_name == name
    assert evaluate_rules(application).eligible is expect_fit

    result = run(check_eligibility(application, use_llm=False, persist=False, source="pdf"))
    assert result.eligible is expect_fit
    assert result.rule_check.eligible is expect_fit
    assert result.source == "pdf"
