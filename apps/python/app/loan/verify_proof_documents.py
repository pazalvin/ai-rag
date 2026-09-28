import re
from dataclasses import dataclass

from app.loan.classify_proof_document import classify_proof_document
from app.loan.extract_proof_signals import ExtractedProofSignals, extract_proof_signals
from app.loan.load_rules import load_loan_rules
from app.loan.rules_schema import DocumentVerificationConfig, LoanRules, ProofDocumentType
from app.models import CamelModel, js_num
from app.schemas import LoanApplication


@dataclass
class ProofDocumentInput:
    file_name: str
    text: str


class ProofDocumentAssessment(CamelModel):
    file_name: str
    type: ProofDocumentType
    confidence: float
    related_to_loan_capacity: bool
    matched_keywords: list[str]
    signals: ExtractedProofSignals
    issues: list[str]
    accepted: bool


class DocumentVerificationResult(CamelModel):
    passed: bool
    required: bool
    summary: list[str]
    documents: list[ProofDocumentAssessment]
    config: DocumentVerificationConfig


def _normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z\s]", " ", value.lower())).strip()


def _names_roughly_match(claimed: str, extracted: str | None) -> bool:
    if not extracted:
        return False
    a = _normalize_name(claimed)
    b = _normalize_name(extracted)
    if not a or not b:
        return False
    if a == b:
        return True
    a_parts = [p for p in a.split(" ") if len(p) > 1]
    b_parts = {p for p in b.split(" ") if len(p) > 1}
    overlap = sum(1 for p in a_parts if p in b_parts)
    return overlap >= min(2, len(a_parts))


def _income_within_tolerance(claimed: float, evidence: float, tolerance_percent: float) -> bool:
    if claimed <= 0:
        return False
    return abs(claimed - evidence) / claimed <= tolerance_percent / 100


def verify_proof_documents(
    application: LoanApplication,
    proofs: list[ProofDocumentInput],
    rules: LoanRules | None = None,
) -> DocumentVerificationResult:
    """
    Verify proof documents (payslip, bank statement, COE) against the application.
    Checks: document is capacity-related, type accepted, name/income consistency.
    """
    cfg = (rules or load_loan_rules()).document_verification
    summary: list[str] = []
    documents: list[ProofDocumentAssessment] = []

    if not cfg.required:
        return DocumentVerificationResult(
            passed=True,
            required=False,
            summary=["Proof document verification is disabled in rules."],
            documents=[],
            config=cfg,
        )

    if len(proofs) < cfg.min_proof_documents:
        summary.append(
            f"At least {cfg.min_proof_documents} proof document(s) required (payslip, bank "
            f"statement, or employment certificate). Received {len(proofs)}."
        )

    has_accepted_income_proof = False
    tolerance = js_num(cfg.income_match_tolerance_percent)

    for proof in proofs:
        classification = classify_proof_document(proof.text)
        signals = extract_proof_signals(proof.text, classification.type)
        issues: list[str] = []

        if not classification.related_to_loan_capacity or classification.type == "unknown":
            issues.append(
                "Document does not look like a payslip, bank statement, or employment "
                "certificate related to loan capacity."
            )

        if cfg.reject_unknown_types and classification.type not in cfg.accepted_types:
            issues.append(f'Document type "{classification.type}" is not in accepted proof types.')

        if cfg.require_name_match:
            if not signals.employee_or_account_name:
                issues.append("Could not find an employee/account name on the document.")
            elif not _names_roughly_match(application.full_name, signals.employee_or_account_name):
                issues.append(
                    f'Name on document ("{signals.employee_or_account_name}") does not match '
                    f'applicant ("{application.full_name}").'
                )

        if classification.type in ("payslip", "bank_statement"):
            evidence = signals.monthly_income_evidence
            if evidence is None:
                issues.append("Could not extract income / salary evidence from document.")
            elif not _income_within_tolerance(
                application.monthly_income, evidence, cfg.income_match_tolerance_percent
            ):
                issues.append(
                    f"Income on document ({js_num(evidence)}) is outside {tolerance}% of claimed "
                    f"monthly income ({application.monthly_income})."
                )
            else:
                has_accepted_income_proof = True

        if classification.type == "employment_certificate" and not issues:
            # COE can support employment; income still preferred from payslip/bank
            has_accepted_income_proof = has_accepted_income_proof or len(proofs) == 1

        documents.append(
            ProofDocumentAssessment(
                file_name=proof.file_name,
                type=classification.type,
                confidence=classification.confidence,
                related_to_loan_capacity=classification.related_to_loan_capacity,
                matched_keywords=classification.matched_keywords,
                signals=signals,
                issues=issues,
                accepted=not issues and classification.related_to_loan_capacity,
            )
        )

    accepted_count = sum(1 for d in documents if d.accepted)
    if proofs and accepted_count == 0:
        summary.append("No uploaded proof documents passed verification.")

    income_mismatch_msg = (
        "No accepted payslip/bank statement income evidence matched the claimed monthly income."
    )
    needs_income_doc = any(d.type in ("payslip", "bank_statement") for d in documents)
    if (
        len(proofs) >= cfg.min_proof_documents
        and needs_income_doc
        and not has_accepted_income_proof
        and all(d.type != "employment_certificate" or not d.accepted for d in documents)
    ):
        summary.append(income_mismatch_msg)

    if (
        len(proofs) >= cfg.min_proof_documents
        and accepted_count > 0
        and has_accepted_income_proof
        and income_mismatch_msg in summary
    ):
        summary.remove(income_mismatch_msg)

    if accepted_count > 0 and has_accepted_income_proof:
        summary.append(
            f"{accepted_count} proof document(s) verified as related to repayment capacity."
        )

    passed = (
        len(proofs) >= cfg.min_proof_documents
        and accepted_count >= cfg.min_proof_documents
        and has_accepted_income_proof
    )
    if passed and not summary:
        summary.append("Proof documents verified successfully.")

    return DocumentVerificationResult(
        passed=passed, required=True, summary=summary, documents=documents, config=cfg
    )
