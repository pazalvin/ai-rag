import io

from pypdf import PdfReader


def pdf_text_from_bytes(data: bytes) -> str:
    """Extract text from all pages, merged with newlines."""
    reader = PdfReader(io.BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_pdf_text(data: bytes) -> str:
    raw_text = pdf_text_from_bytes(data).strip()
    if not raw_text:
        raise ValueError("No extractable text in PDF")
    return raw_text
