import httpx

from app.config import config


async def embed_text(text: str) -> list[float]:
    """Create an embedding vector via Ollama /api/embeddings."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                f"{config.ollama_base_url}/api/embeddings",
                json={"model": config.embed_model, "prompt": text},
            )
    except httpx.HTTPError as err:
        raise RuntimeError(f"Embedding failed (network): {err}") from err

    if not res.is_success:
        raise RuntimeError(f"Embedding failed ({res.status_code}): {res.text}")

    embedding = res.json().get("embedding") or []
    if not embedding:
        raise RuntimeError("Embedding response missing embedding array")

    if len(embedding) != config.embedding_dimensions:
        raise RuntimeError(
            f"Expected {config.embedding_dimensions}-dim embedding, got {len(embedding)}"
        )

    return embedding


def to_vector_literal(embedding: list[float]) -> str:
    return "[" + ",".join(str(x) for x in embedding) + "]"
