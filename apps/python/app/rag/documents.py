import re
from pathlib import Path

from app.loan.pdf_text import pdf_text_from_bytes

GUIDELINE_EXTENSIONS = {".md", ".txt", ".pdf"}


def load_guideline_text(file_path: Path) -> str:
    """Load plain text from a guideline file (.md, .txt, or .pdf)."""
    ext = file_path.suffix.lower()

    if ext in {".md", ".txt"}:
        return file_path.read_text(encoding="utf-8")

    if ext == ".pdf":
        text = pdf_text_from_bytes(file_path.read_bytes())
        normalized = text.replace("\r\n", "\n")
        normalized = re.sub(r"[ \t]+\n", "\n", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()
        if not normalized:
            raise ValueError(f"No extractable text in PDF: {file_path.name}")
        return normalized

    raise ValueError(f"Unsupported guideline format: {ext}")


def list_guideline_files(directory: Path) -> list[str]:
    return sorted(
        p.name
        for p in directory.iterdir()
        if p.is_file() and p.suffix.lower() in GUIDELINE_EXTENSIONS
    )
