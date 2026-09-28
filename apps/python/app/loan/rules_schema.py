from typing import Annotated, Literal

from pydantic import Field

from app.models import CamelModel

ProofDocumentType = Literal["payslip", "bank_statement", "employment_certificate", "unknown"]

NonNegNumber = Annotated[int | float, Field(ge=0)]
Ratio = Annotated[int | float, Field(gt=0, le=1)]


class TenureRequirement(CamelModel):
    at_or_below_threshold_months: int = Field(ge=0)
    above_threshold_months: int = Field(ge=0)


class DocumentVerificationConfig(CamelModel):
    required: bool = True
    min_proof_documents: int = Field(default=1, ge=0)
    accepted_types: list[ProofDocumentType] = Field(
        default_factory=lambda: ["payslip", "bank_statement", "employment_certificate"]
    )
    income_match_tolerance_percent: Annotated[int | float, Field(ge=0, le=100)] = 15
    require_name_match: bool = True
    reject_unknown_types: bool = True


class IntRange(CamelModel):
    min: int = Field(ge=0)
    max: int = Field(ge=0)


class LoanTermRange(CamelModel):
    min: int = Field(ge=1)
    max: int = Field(ge=1)


class IncomeBand(CamelModel):
    max_loan_amount: NonNegNumber
    min_monthly_income: NonNegNumber
    label: str = Field(min_length=1)


class TenureRules(CamelModel):
    loan_amount_threshold: NonNegNumber
    by_employment_status: dict[str, TenureRequirement]


class RestrictedBand(CamelModel):
    min: int = Field(ge=0)
    max: int = Field(ge=0)
    max_dti: Ratio
    max_loan_amount: NonNegNumber


class CreditScoreRules(CamelModel):
    decline_below: int = Field(ge=0)
    restricted_band: RestrictedBand


class LoanRules(CamelModel):
    version: str = Field(min_length=1)
    description: str | None = None
    age: IntRange
    allowed_employment_statuses: list[Annotated[str, Field(min_length=1)]] = Field(min_length=1)
    income_floor_monthly: NonNegNumber
    max_loan_amount: NonNegNumber
    loan_term_months: LoanTermRange
    max_dti: Ratio
    max_installment_to_income_ratio: Ratio
    income_bands: list[IncomeBand] = Field(min_length=1)
    tenure: TenureRules
    credit_score: CreditScoreRules
    document_verification: DocumentVerificationConfig = Field(
        default_factory=DocumentVerificationConfig
    )
