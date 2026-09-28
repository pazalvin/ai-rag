from dataclasses import dataclass

from app.config import is_offline_eligibility_mode
from app.loan.check_eligibility import PdfEligibilityResponse, check_eligibility
from app.loan.parse_applicant_pdf import parse_applicant_pdf
from app.loan.pdf_text import extract_pdf_text
from app.loan.verify_proof_documents import ProofDocumentInput


@dataclass
class ProofFile:
    file_name: str
    data: bytes


class AssessDocumentsResult(PdfEligibilityResponse):
    proof_file_names: list[str]


async def assess_documents(
    application_pdf: bytes,
    proofs: list[ProofFile],
    application_file_name: str | None = None,
    offline: bool | None = None,
) -> AssessDocumentsResult:
    """Full pipeline: parse application PDF + verify proof PDFs + eligibility."""
    if not proofs:
        raise ValueError(
            "At least one proof PDF is required (payslip, bank statement, or employment certificate)."
        )

    application, raw_text = parse_applicant_pdf(application_pdf)
    proof_documents = [
        ProofDocumentInput(file_name=p.file_name, text=extract_pdf_text(p.data)) for p in proofs
    ]

    offline = is_offline_eligibility_mode() if offline is None else offline
    result = await check_eligibility(
        application,
        source="documents",
        proof_documents=proof_documents,
        verify_documents=True,
        use_llm=not offline,
        persist=not offline,
    )

    return AssessDocumentsResult(
        **dict(result),
        uploaded_file_name=application_file_name or "application.pdf",
        extracted_text_preview=raw_text[:500],
        proof_file_names=[p.file_name for p in proof_documents],
    )
