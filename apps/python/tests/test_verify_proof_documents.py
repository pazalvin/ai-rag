import re

from app.loan.load_rules import load_loan_rules
from app.loan.verify_proof_documents import ProofDocumentInput, verify_proof_documents

MATCHING_PAYSLIP = """
  Payslip / Pay Slip / Payroll
  Employee Name: Jane Doe
  Employer: Acme Manufacturing Inc.
  Pay Period: June 2026
  Gross Pay: 45000
  Net Pay: 45000
  Basic Salary: 45000
  YTD Earnings: 270000
"""


def test_passes_matching_payslip(jane):
    result = verify_proof_documents(jane, [ProofDocumentInput("payslip.txt", MATCHING_PAYSLIP)])
    assert result.passed is True
    doc = result.documents[0]
    assert doc.type == "payslip"
    assert doc.accepted is True
    assert doc.issues == []


def test_fails_without_proofs_when_required(jane):
    assert load_loan_rules().document_verification.required is True
    result = verify_proof_documents(jane, [])
    assert result.passed is False
    assert any(re.search(r"at least 1 proof", s, re.I) for s in result.summary)


def test_fails_unrelated_document(jane):
    result = verify_proof_documents(
        jane,
        [ProofDocumentInput("utility.txt", "Electric Utility Bill Amount Due: 3200 Meter Reading: 1")],
    )
    assert result.passed is False
    assert result.documents[0].related_to_loan_capacity is False


def test_fails_income_outside_tolerance(jane):
    text = """
      Payslip / Pay Slip / Payroll
      Employee Name: Jane Doe
      Employer: Acme
      Gross Pay: 18000
      Net Pay: 18000
      Basic Salary: 18000
      YTD Earnings: 50000
    """
    result = verify_proof_documents(jane, [ProofDocumentInput("low-payslip.txt", text)])
    assert result.passed is False
    assert any(re.search(r"outside .* of claimed", i, re.I) for i in result.documents[0].issues)


def test_fails_name_mismatch(jane):
    text = """
      Payslip / Pay Slip / Payroll
      Employee Name: John Smith
      Employer: Acme
      Net Pay: 45000
      Gross Pay: 45000
      Basic Salary: 45000
      YTD Earnings: 100000
    """
    result = verify_proof_documents(jane, [ProofDocumentInput("other-person.txt", text)])
    assert result.passed is False
    assert any(re.search(r"does not match applicant", i, re.I) for i in result.documents[0].issues)


def test_skips_when_disabled(jane):
    rules = load_loan_rules()
    rules = rules.model_copy(
        update={
            "document_verification": rules.document_verification.model_copy(
                update={"required": False}
            )
        }
    )
    result = verify_proof_documents(jane, [], rules)
    assert result.passed is True
    assert result.required is False
