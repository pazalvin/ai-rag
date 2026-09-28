import asyncio
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ["ELIGIBILITY_OFFLINE"] = "1"

from app.config import ROOT_DIR  # noqa: E402
from app.main import create_app  # noqa: E402
from app.schemas import LoanApplication  # noqa: E402

APPLICATIONS_DIR = ROOT_DIR / "testdata" / "applications"
PROOFS_DIR = ROOT_DIR / "testdata" / "proofs"


def fixture_pdf(directory: Path, name: str) -> bytes:
    path = directory / name
    if not path.exists():
        pytest.fail(f"Missing fixture {path}. Run the TS generate scripts first.")
    return path.read_bytes()


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(run_startup=False))


@pytest.fixture
def jane() -> LoanApplication:
    return LoanApplication(
        full_name="Jane Doe",
        age=32,
        monthly_income=45000,
        employment_status="employed",
        months_employed=18,
        loan_amount=200000,
        loan_term_months=36,
        credit_score=720,
        existing_debt=15000,
    )
