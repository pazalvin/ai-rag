import re

from app.loan.rules_schema import ProofDocumentType
from app.models import CamelModel


class ExtractedProofSignals(CamelModel):
    document_type: ProofDocumentType
    employee_or_account_name: str | None = None
    employer_name: str | None = None
    # Best guess of monthly income / salary credit from the document.
    monthly_income_evidence: int | float | None = None
    amounts_found: list[int]
    notes: list[str]


def _label_pattern(label: str) -> str:
    return r"\s+".join(re.escape(part) for part in label.split())


def _to_number(raw: str) -> int | float:
    value = float(raw.replace(",", ""))
    return int(value) if value.is_integer() else value


def _pick_labeled_amount(text: str, labels: list[str]) -> int | float | None:
    for label in labels:
        match = re.search(
            _label_pattern(label)
            + r"\s*[:\-]?\s*(?:PHP|₱|USD|\$)?\s*([0-9][0-9,]*(?:\.\d+)?)",
            text,
            re.IGNORECASE,
        )
        if match:
            return _to_number(match.group(1))
    return None


def _pick_labeled_string(text: str, labels: list[str]) -> str | None:
    for label in labels:
        match = re.search(
            _label_pattern(label)
            + r"\s*[:\-]?\s*(.+?)(?=(?:\s{2,}|\n|[A-Z][a-z]+\s*:)|\Z)",
            text,
            re.IGNORECASE,
        )
        if match and match.group(1):
            return re.sub(r"\s+", " ", match.group(1)).strip()
    return None


def _collect_currency_amounts(text: str) -> list[int]:
    amounts: set[int] = set()
    for match in re.finditer(
        r"(?:PHP|₱|USD|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d+)?|[0-9]{4,}(?:\.\d+)?)", text
    ):
        n = float(match.group(1).replace(",", ""))
        if n >= 1000:
            amounts.add(round(n))
    return sorted(amounts, reverse=True)


def extract_proof_signals(text: str, document_type: ProofDocumentType) -> ExtractedProofSignals:
    """Extract income / identity signals from a classified proof document."""
    notes: list[str] = []
    amounts_found = _collect_currency_amounts(text)

    employee_or_account_name = (
        _pick_labeled_string(
            text,
            [
                "Employee Name",
                "Account Name",
                "Account Holder",
                "Name of Employee",
                "Full Name",
                "Name",
            ],
        )
        or None
    )
    employer_name = (
        _pick_labeled_string(text, ["Employer", "Company Name", "Employer Name", "Company"])
        or None
    )

    evidence: int | float | None = None
    if document_type == "payslip":
        evidence = _pick_labeled_amount(
            text,
            ["Net Pay", "Net Salary", "Take Home Pay", "Gross Pay", "Basic Salary", "Monthly Salary"],
        )
        if evidence is None and amounts_found:
            evidence = amounts_found[0]
        if evidence:
            notes.append(f"Payslip income evidence: {evidence}")
    elif document_type == "bank_statement":
        evidence = _pick_labeled_amount(
            text,
            [
                "Salary Credit",
                "Payroll Credit",
                "Monthly Salary Credit",
                "Average Monthly Credit",
                "Salary Deposit",
            ],
        )
        if evidence is None and amounts_found:
            evidence = amounts_found[0]
        if evidence:
            notes.append(f"Bank statement income evidence: {evidence}")
    elif document_type == "employment_certificate":
        evidence = _pick_labeled_amount(
            text, ["Monthly Salary", "Basic Salary", "Compensation", "Salary"]
        )
        if evidence:
            notes.append(f"COE income evidence: {evidence}")
        else:
            notes.append("COE found but no salary amount extracted.")
    else:
        notes.append("Document type unknown — limited extraction.")

    return ExtractedProofSignals(
        document_type=document_type,
        employee_or_account_name=employee_or_account_name,
        employer_name=employer_name,
        monthly_income_evidence=evidence,
        amounts_found=amounts_found[:10],
        notes=notes,
    )
