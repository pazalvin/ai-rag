import math


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Explicit cosine similarity — useful for tests and understanding the math.
    Production retrieval uses pgvector's cosine distance operator in Postgres.
    """
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a)
    nb = sum(y * y for y in b)

    denom = math.sqrt(na) * math.sqrt(nb)
    return 0.0 if denom == 0 else dot / denom
