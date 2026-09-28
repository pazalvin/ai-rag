import re

from pydantic import ValidationError

from app.loan.load_rules import format_validation_error
from app.loan.pdf_text import pdf_text_from_bytes
from app.schemas import LoanApplication

FIELD_LABELS = [
    "Full Name",
    "Applicant Name",
    "Name",
    "Age",
    "Monthly Income",
    "Income",
    "Salary",
    "Employment Status",
    "Employment",
    "Work Status",
    "Months Employed",
    "Months at Current Work",
    "Work Tenure Months",
    "Tenure Months",
    "Loan Amount",
    "Requested Loan",
    "Loan Term Months",
    "Loan Term",
    "Term Months",
    "Credit Score",
    "Existing Debt",
    "Current Debt",
]


def _label_pattern(label: str) -> str:
    return r"\s+".join(re.escape(part) for part in label.split())


# Longest labels first so "Loan Term Months" wins over "Term"
_STOP = "|".join(_label_pattern(l) for l in sorted(FIELD_LABELS, key=len, reverse=True))

_PROOF_HINT_RE = re.compile(
    r"\b(payslip|pay\s*slip|payroll|bank\s*statement|certificate\s+of\s+employment|employee\s+name)\b",
    re.IGNORECASE,
)


def _pick_value(text: str, labels: list[str]) -> str | None:
    for label in labels:
        match = re.search(
            _label_pattern(label) + rf"\s*[:\-]?\s*(.+?)(?=(?:\s+(?:{_STOP})\s*[:\-])|\Z)",
            text,
            re.IGNORECASE,
        )
        if match and match.group(1):
            return re.sub(r"\s+", " ", match.group(1)).strip()
    return None


def _pick_number(text: str, labels: list[str]) -> int | None:
    value = _pick_value(text, labels)
    if not value:
        return None
    num = re.search(r"[0-9][0-9,]*", value)
    return int(num.group(0).replace(",", "")) if num else None


def parse_applicant_text(text: str) -> LoanApplication:
    """
    Parse a loan application PDF into structured fields.
    Expects labeled values such as "Monthly Income: 45000".
    """
    normalized = re.sub(r"\s+", " ", text.replace("\r\n", "\n")).strip()

    raw = {
        "fullName": _pick_value(normalized, ["Full Name", "Applicant Name", "Name"]),
        "age": _pick_number(normalized, ["Age"]),
        "monthlyIncome": _pick_number(normalized, ["Monthly Income", "Income", "Salary"]),
        "employmentStatus": _pick_value(
            normalized, ["Employment Status", "Employment", "Work Status"]
        ),
        "monthsEmployed": _pick_number(
            normalized,
            ["Months Employed", "Months at Current Work", "Work Tenure Months", "Tenure Months"],
        ),
        "loanAmount": _pick_number(normalized, ["Loan Amount", "Requested Loan"]),
        "loanTermMonths": _pick_number(normalized, ["Loan Term Months", "Loan Term", "Term Months"]),
        "creditScore": _pick_number(normalized, ["Credit Score"]),
        "existingDebt": _pick_number(normalized, ["Existing Debt", "Current Debt"]),
    }

    try:
        return LoanApplication.model_validate(raw)
    except ValidationError as err:
        hint = (
            " This file looks like a proof document (payslip / bank statement / COE). Upload a "
            "loan application PDF in the Application field (e.g. "
            "testdata/applications/eligible-jane-doe.pdf), and put proofs in the Proof "
            "documents field."
            if _PROOF_HINT_RE.search(normalized)
            else " Application PDFs need labeled fields such as: Full Name, Age, Monthly Income, "
            "Employment Status, Months Employed, Loan Amount, Loan Term Months, Credit Score, "
            "Existing Debt."
        )
        raise ValueError(
            f"Could not parse application PDF fields: {format_validation_error(err)}.{hint}"
        ) from err


def parse_applicant_pdf(data: bytes) -> tuple[LoanApplication, str]:
    """Return (application, raw_text)."""
    raw_text = pdf_text_from_bytes(data).strip()
    if not raw_text:
        raise ValueError("No extractable text in application PDF")
    return parse_applicant_text(raw_text), raw_text
