from psycopg.rows import dict_row

from app.config import config
from app.db import get_pool
from app.models import CamelModel
from app.rag.embedder import embed_text, to_vector_literal
from app.schemas import LoanApplication


class MatchedChunk(CamelModel):
    """Matched chunk shape returned by cosine top-k retrieval."""

    id: int
    source: str
    text: str
    score: float


def build_query(application: LoanApplication) -> str:
    """Build a short retrieval query from loan application fields."""
    return " ".join(
        [
            f"loan eligibility age {application.age}",
            f"monthly income {application.monthly_income}",
            f"employment {application.employment_status}",
            f"work tenure {application.months_employed} months",
            f"loan amount {application.loan_amount}",
            f"term {application.loan_term_months} months",
            f"credit score {application.credit_score}",
            f"existing debt {application.existing_debt}",
            "minimum salary income capacity employment tenure debt to income installment affordability",
        ]
    )


async def retrieve_relevant_chunks(
    application: LoanApplication, k: int | None = None
) -> list[MatchedChunk]:
    """
    Embed the application query and return top-k chunks by pgvector cosine distance.
    score = 1 - cosine_distance (higher is more similar).
    """
    embedding = await embed_text(build_query(application))
    vector = to_vector_literal(embedding)

    pool = await get_pool()
    async with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            SELECT
              id,
              source,
              content AS text,
              (1 - (embedding <=> %(v)s::vector))::float8 AS score
            FROM guideline_chunks
            ORDER BY embedding <=> %(v)s::vector
            LIMIT %(k)s
            """,
            {"v": vector, "k": k or config.top_k},
        )
        rows = await cur.fetchall()

    return [MatchedChunk(**row) for row in rows]


async def count_chunks() -> int:
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT count(*)::int FROM guideline_chunks")
        row = await cur.fetchone()
    return int(row[0]) if row else 0
