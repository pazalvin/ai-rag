import re

import pytest

from app.loan.assess_documents import ProofFile, assess_documents
from app.loan.load_rules import load_loan_rules
from tests.conftest import APPLICATIONS_DIR, PROOFS_DIR, fixture_pdf, run

JANE_APP = "eligible-jane-doe.pdf"


def _pdf(name: str, data: bytes) -> tuple[str, bytes, str]:
    return (name, data, "application/pdf")


@pytest.mark.parametrize(
    ("proof", "expect_fit", "expect_type"),
    [
        ("payslip-jane-doe.pdf", True, "payslip"),
        ("utility-bill-unrelated.pdf", False, None),
        ("payslip-income-mismatch.pdf", False, None),
        ("bank-statement-jane-doe.pdf", True, "bank_statement"),
    ],
)
def test_assess_documents_service(proof, expect_fit, expect_type):
    result = run(
        assess_documents(
            application_pdf=fixture_pdf(APPLICATIONS_DIR, JANE_APP),
            application_file_name=JANE_APP,
            proofs=[ProofFile(proof, fixture_pdf(PROOFS_DIR, proof))],
            offline=True,
        )
    )
    assert result.eligible is expect_fit
    assert result.document_verification is not None
    assert result.document_verification.passed is expect_fit
    assert result.rule_check.eligible is True
    assert result.proof_file_names == [proof]
    if expect_type:
        assert result.document_verification.documents[0].type == expect_type


def test_assess_documents_requires_proofs(client):
    res = client.post(
        "/api/assess-documents",
        files={"application": _pdf(JANE_APP, fixture_pdf(APPLICATIONS_DIR, JANE_APP))},
    )
    assert res.status_code == 400
    assert re.search(r"missing proof", res.json()["error"], re.I)


@pytest.mark.parametrize(
    ("proof", "expect_fit"),
    [("payslip-jane-doe.pdf", True), ("utility-bill-unrelated.pdf", False)],
)
def test_assess_documents_http(client, proof, expect_fit):
    res = client.post(
        "/api/assess-documents",
        files=[
            ("application", _pdf(JANE_APP, fixture_pdf(APPLICATIONS_DIR, JANE_APP))),
            ("proofs", _pdf(proof, fixture_pdf(PROOFS_DIR, proof))),
        ],
    )
    assert res.status_code == 200
    body = res.json()
    assert body["eligible"] is expect_fit
    assert body["documentVerification"]["passed"] is expect_fit
    assert body["proofFileNames"] == [proof]
    assert "applicationId" not in body


def test_check_eligibility_pdf_requires_file(client):
    res = client.post("/api/check-eligibility-pdf", data={})
    assert res.status_code == 400


def test_check_eligibility_pdf(client):
    res = client.post(
        "/api/check-eligibility-pdf",
        files={"file": _pdf(JANE_APP, fixture_pdf(APPLICATIONS_DIR, JANE_APP))},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["eligible"] is True
    assert body["fullName"] == "Jane Doe"
    assert body["source"] == "pdf"
    assert body["uploadedFileName"] == JANE_APP


def test_check_eligibility_json(client):
    res = client.post(
        "/api/check-eligibility",
        json={
            "fullName": "Jane Doe",
            "age": "32",
            "monthlyIncome": 45000,
            "employmentStatus": " Employed ",
            "monthsEmployed": 18,
            "loanAmount": 200000,
            "loanTermMonths": 36,
            "creditScore": 720,
            "existingDebt": 15000,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["eligible"] is True
    assert body["matched_rules"]
    assert body["parsedApplication"]["employmentStatus"] == "employed"


def test_check_eligibility_invalid(client):
    res = client.post("/api/check-eligibility", json={"fullName": "", "age": 10})
    assert res.status_code == 400
    body = res.json()
    assert body["error"] == "Invalid application"
    assert "age" in body["detail"]["fieldErrors"]


def test_get_rules(client):
    res = client.get("/api/rules")
    assert res.status_code == 200
    rules = res.json()["rules"]
    file_rules = load_loan_rules()
    assert rules["version"] == file_rules.version
    assert rules["incomeFloorMonthly"] == file_rules.income_floor_monthly


def test_unknown_route_is_json_404(client):
    res = client.get("/api/nope")
    assert res.status_code == 404
    assert res.json() == {"error": "Not found"}
