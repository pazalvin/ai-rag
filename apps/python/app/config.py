import os
from dataclasses import dataclass
from pathlib import Path

# apps/python/app/config.py -> repository root (shared data/ lives there)
ROOT_DIR = Path(__file__).resolve().parents[3]


def _int_env(name: str, fallback: int) -> int:
    try:
        return int(os.environ.get(name, "")) or fallback
    except ValueError:
        return fallback


def _loan_rules_path() -> Path:
    from_env = os.environ.get("LOAN_RULES_PATH")
    if not from_env:
        return ROOT_DIR / "data" / "rules" / "loan-rules.json"
    path = Path(from_env)
    return path if path.is_absolute() else (ROOT_DIR / path).resolve()


@dataclass(frozen=True)
class Config:
    port: int
    database_url: str
    ollama_base_url: str
    llm_model: str
    embed_model: str
    embedding_dimensions: int
    top_k: int
    chunk_size: int
    chunk_overlap: int
    guidelines_dir: Path
    loan_rules_path: Path


config = Config(
    port=_int_env("PORT", 8000),
    database_url=os.environ.get(
        "DATABASE_URL", "postgres://loan:loan@localhost:5432/loan_rag"
    ),
    ollama_base_url=os.environ.get("OLLAMA_BASE_URL") or "http://localhost:11434",
    llm_model=os.environ.get("LLM_MODEL") or "llama3.2:1b",
    embed_model=os.environ.get("EMBED_MODEL") or "nomic-embed-text",
    embedding_dimensions=_int_env("EMBEDDING_DIMENSIONS", 768),
    top_k=_int_env("TOP_K", 3),
    chunk_size=_int_env("CHUNK_SIZE", 400),
    chunk_overlap=_int_env("CHUNK_OVERLAP", 50),
    guidelines_dir=ROOT_DIR / "data" / "guidelines",
    loan_rules_path=_loan_rules_path(),
)


def is_offline_eligibility_mode() -> bool:
    """Skip Ollama + DB (used by tests)."""
    return os.environ.get("ELIGIBILITY_OFFLINE") == "1"
