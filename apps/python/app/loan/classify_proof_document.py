import re

from app.loan.rules_schema import ProofDocumentType
from app.models import CamelModel

CLASSIFIERS: list[tuple[ProofDocumentType, float, list[str]]] = [
    (
        "payslip",
        1,
        [
            "payslip",
            "pay slip",
            "salary slip",
            "net pay",
            "gross pay",
            "basic salary",
            "payroll",
            "pay period",
            "employer",
            "ytd earnings",
        ],
    ),
    (
        "bank_statement",
        1,
        [
            "bank statement",
            "account statement",
            "account number",
            "opening balance",
            "closing balance",
            "salary credit",
            "deposit",
            "withdrawal",
            "transaction history",
            "available balance",
        ],
    ),
    (
        "employment_certificate",
        1,
        [
            "certificate of employment",
            "employment certificate",
            "currently employed",
            "position",
            "date hired",
            "this is to certify",
            "human resources",
            "tenure",
        ],
    ),
]


class ClassificationResult(CamelModel):
    type: ProofDocumentType
    confidence: float
    matched_keywords: list[str]
    related_to_loan_capacity: bool


def classify_proof_document(text: str) -> ClassificationResult:
    """
    Classify a proof document from its extracted text (keyword scoring).
    Documents that look like payslips / bank statements / COE are treated as
    related to loan repayment capacity.
    """
    normalized = re.sub(r"\s+", " ", text.lower())
    scores: dict[str, float] = {}
    hits: dict[str, list[str]] = {}

    for doc_type, weight, keywords in CLASSIFIERS:
        scores[doc_type] = 0
        hits[doc_type] = []
        for keyword in keywords:
            if keyword in normalized:
                scores[doc_type] += weight
                hits[doc_type].append(keyword)

    best: ProofDocumentType = "unknown"
    best_score: float = 0
    for doc_type, _, _ in CLASSIFIERS:
        if scores[doc_type] > best_score:
            best_score = scores[doc_type]
            best = doc_type

    # Need at least 2 keyword hits to avoid weak false positives
    if best_score < 2:
        return ClassificationResult(
            type="unknown", confidence=0, matched_keywords=[], related_to_loan_capacity=False
        )

    return ClassificationResult(
        type=best,
        confidence=min(1, best_score / 5),
        matched_keywords=hits[best],
        related_to_loan_capacity=True,
    )
