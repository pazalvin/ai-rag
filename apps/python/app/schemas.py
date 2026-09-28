from typing import Annotated

from pydantic import Field, StringConstraints, field_validator

from app.models import CamelModel


class LoanApplication(CamelModel):
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    age: int = Field(ge=18, le=100)
    monthly_income: int = Field(ge=0)
    employment_status: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, to_lower=True)
    ]
    months_employed: int = Field(ge=0, le=600)
    loan_amount: int = Field(ge=0)
    loan_term_months: int = Field(ge=1, le=120)
    credit_score: int = Field(ge=300, le=850)
    existing_debt: int = Field(ge=0)

    @field_validator("full_name", "employment_status", mode="before")
    @classmethod
    def _coerce_str(cls, value: object) -> object:
        return str(value) if isinstance(value, (int, float)) else value
