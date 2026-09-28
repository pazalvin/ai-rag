import logging

from fastapi import APIRouter, File, UploadFile

from app.config import is_offline_eligibility_mode
from app.loan.assess_documents import AssessDocumentsResult, ProofFile, assess_documents
from app.loan.check_eligibility import (
    EligibilityResponse,
    PdfEligibilityResponse,
    check_eligibility,
)
from app.loan.parse_applicant_pdf import parse_applicant_pdf
from app.loan.pdf_text import extract_pdf_text
from app.loan.verify_proof_documents import ProofDocumentInput
from app.routes.errors import error_response
from app.schemas import LoanApplication

logger = logging.getLogger(__name__)

router = APIRouter()

RESPONSE_OPTS = {"response_model_exclude_none": True}


def _is_pdf(file: UploadFile) -> bool:
    return (file.filename or "").lower().endswith(".pdf") or file.content_type == "application/pdf"


async def _collect_proof_files(*groups: list[UploadFile] | None) -> list[ProofFile]:
    proofs: list[ProofFile] = []
    for group in groups:
        for item in group or []:
            if not _is_pdf(item):
                raise ValueError(f"Proof file must be PDF: {item.filename}")
            proofs.append(ProofFile(file_name=item.filename or "proof.pdf", data=await item.read()))
    return proofs


@router.post("/check-eligibility", response_model=EligibilityResponse, **RESPONSE_OPTS)
async def check_eligibility_route(application: LoanApplication):
    try:
        offline = is_offline_eligibility_mode()
        return await check_eligibility(
            application,
            source="form",
            verify_documents=False,
            use_llm=not offline,
            persist=not offline,
        )
    except Exception as err:
        logger.exception("Eligibility check failed")
        return error_response(500, "Eligibility check failed", str(err))


@router.post("/check-eligibility-pdf", response_model=PdfEligibilityResponse, **RESPONSE_OPTS)
async def check_eligibility_pdf_route(
    file: UploadFile | None = File(None, description="Application PDF"),
    proofs: list[UploadFile] | None = File(None),
    proof: list[UploadFile] | None = File(None),
    documents: list[UploadFile] | None = File(None),
):
    if file is None:
        return error_response(
            400, "Missing application PDF", "Upload field `file` is required"
        )
    if not _is_pdf(file):
        return error_response(400, "Only PDF uploads are supported")

    try:
        application, raw_text = parse_applicant_pdf(await file.read())
        proof_files = await _collect_proof_files(proofs, proof, documents)
        proof_documents = [
            ProofDocumentInput(file_name=p.file_name, text=extract_pdf_text(p.data))
            for p in proof_files
        ]
        offline = is_offline_eligibility_mode()

        result = await check_eligibility(
            application,
            source="documents" if proof_documents else "pdf",
            proof_documents=proof_documents,
            verify_documents=bool(proof_documents),
            use_llm=not offline,
            persist=not offline,
        )
        return PdfEligibilityResponse(
            **dict(result),
            uploaded_file_name=file.filename or "application.pdf",
            extracted_text_preview=raw_text[:500],
        )
    except Exception as err:
        logger.exception("PDF eligibility check failed")
        return error_response(500, "PDF eligibility check failed", str(err))


@router.post("/assess-documents", response_model=AssessDocumentsResult, **RESPONSE_OPTS)
async def assess_documents_route(
    application: UploadFile | None = File(None, description="Application PDF"),
    file: UploadFile | None = File(None, description="Alias for `application`"),
    proofs: list[UploadFile] | None = File(None, description="Payslip / bank statement / COE PDFs"),
    proof: list[UploadFile] | None = File(None),
    documents: list[UploadFile] | None = File(None),
):
    application_file = application or file
    if application_file is None:
        return error_response(
            400,
            "Missing application PDF",
            "Upload field `application` (or `file`) is required",
        )
    if not _is_pdf(application_file):
        return error_response(400, "Application must be a PDF")

    try:
        proof_files = await _collect_proof_files(proofs, proof, documents)
        if not proof_files:
            return error_response(
                400,
                "Missing proof documents",
                "Upload at least one proof PDF in field `proofs` (payslip, bank statement, "
                "or employment certificate).",
            )

        return await assess_documents(
            application_pdf=await application_file.read(),
            application_file_name=application_file.filename,
            proofs=proof_files,
            offline=is_offline_eligibility_mode(),
        )
    except Exception as err:
        logger.exception("Document assessment failed")
        return error_response(500, "Document assessment failed", str(err))
