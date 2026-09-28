from typing import Literal

from psycopg.types.json import Jsonb
from pydantic import Field

from app.db import get_pool
from app.llm.ollama import EligibilityJudgment, judge_eligibility
from app.loan.evaluate_rules import RuleCheckResult, evaluate_rules
from app.loan.verify_proof_documents import (
    DocumentVerificationResult,
    ProofDocumentInput,
    verify_proof_documents,
)
from app.models import CamelModel
from app.rag.retriever import MatchedChunk, retrieve_relevant_chunks
from app.schemas import LoanApplication

Source = Literal["form", "pdf", "documents"]


class EligibilityResponse(CamelModel):
    application_id: int | None = None
    full_name: str
    # Final decision: rules + proof-document verification (when required).
    eligible: bool
    reasons: list[str]
    matched_rules: list[str] = Field(alias="matched_rules")
    rule_check: RuleCheckResult
    document_verification: DocumentVerificationResult | None = None
    ai_check: EligibilityJudgment | None = None
    matched_chunks: list[MatchedChunk]
    raw: str | None = None
    source: Source | None = None
    parsed_application: LoanApplication | None = None
    rules_version: str | None = None


class PdfEligibilityResponse(EligibilityResponse):
    uploaded_file_name: str
    extracted_text_preview: str


async def check_eligibility(
    application: LoanApplication,
    *,
    use_llm: bool = True,
    persist: bool = True,
    source: Source | None = None,
    proof_documents: list[ProofDocumentInput] | None = None,
    verify_documents: bool = False,
) -> EligibilityResponse:
    """Run rules + optional proof-document verification + optional RAG/LLM."""
    proofs = proof_documents or []
    rule_check = evaluate_rules(application)

    document_verification: DocumentVerificationResult | None = None
    if verify_documents or proofs or source == "documents":
        document_verification = verify_proof_documents(application, proofs)

    matched_chunks: list[MatchedChunk] = []
    ai_check: EligibilityJudgment | None = None
    if use_llm:
        chunks = await retrieve_relevant_chunks(application)
        matched_chunks = [c.model_copy(update={"score": round(c.score, 4)}) for c in chunks]
        ai_check = await judge_eligibility(application, chunks)

    doc_ok = (
        document_verification is None
        or not document_verification.required
        or document_verification.passed
    )
    eligible = rule_check.eligible and doc_ok

    reasons = list(rule_check.reasons)
    if document_verification:
        if not document_verification.passed:
            reasons.extend(document_verification.summary)
        for doc in document_verification.documents:
            reasons.extend(f"{doc.file_name}: {issue}" for issue in doc.issues)
    # Deduplicate while preserving order
    unique_reasons = list(dict.fromkeys(reasons))

    application_id: int | None = None
    if persist:
        application_id = await _save_application(
            application, eligible, unique_reasons, rule_check, matched_chunks, ai_check
        )

    return EligibilityResponse(
        application_id=application_id,
        full_name=application.full_name,
        eligible=eligible,
        reasons=unique_reasons,
        matched_rules=rule_check.matched_rules,
        rule_check=rule_check,
        document_verification=document_verification,
        ai_check=ai_check,
        matched_chunks=matched_chunks,
        raw=ai_check.raw if ai_check else None,
        source=source,
        parsed_application=application,
        rules_version=rule_check.rules_version,
    )


async def _save_application(
    application: LoanApplication,
    eligible: bool,
    reasons: list[str],
    rule_check: RuleCheckResult,
    matched_chunks: list[MatchedChunk],
    ai_check: EligibilityJudgment | None,
) -> int | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            INSERT INTO loan_applications (
              full_name, age, monthly_income, employment_status, months_employed,
              loan_amount, loan_term_months, credit_score, existing_debt,
              eligible, reasons, matched_rules, matched_chunk_ids, similarity_scores, raw_llm
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING id
            """,
            (
                application.full_name,
                application.age,
                application.monthly_income,
                application.employment_status,
                application.months_employed,
                application.loan_amount,
                application.loan_term_months,
                application.credit_score,
                application.existing_debt,
                eligible,
                Jsonb(reasons),
                Jsonb(rule_check.matched_rules),
                Jsonb([c.id for c in matched_chunks]),
                Jsonb([c.score for c in matched_chunks]),
                ai_check.raw if ai_check else None,
            ),
        )
        row = await cur.fetchone()
    return int(row[0]) if row else None
