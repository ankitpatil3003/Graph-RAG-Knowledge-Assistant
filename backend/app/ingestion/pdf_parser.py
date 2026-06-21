"""Extract text from uploaded financial filing PDFs."""

import logging
from pathlib import Path
from dataclasses import dataclass

import pdfplumber

logger = logging.getLogger(__name__)


@dataclass
class ParsedDocument:
    filename: str
    pages: list[str]  # text per page
    full_text: str
    page_count: int
    metadata: dict


def parse_pdf(file_path: str | Path) -> ParsedDocument:
    """Extract text from a PDF file, page by page."""
    file_path = Path(file_path)

    pages = []
    metadata = {}

    with pdfplumber.open(file_path) as pdf:
        metadata = pdf.metadata or {}
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)

    full_text = "\n\n".join(pages)

    logger.info(
        "Parsed %s: %d pages, %d chars",
        file_path.name,
        len(pages),
        len(full_text),
    )

    return ParsedDocument(
        filename=file_path.name,
        pages=pages,
        full_text=full_text,
        page_count=len(pages),
        metadata=metadata,
    )


def parse_pdf_bytes(content: bytes, filename: str) -> ParsedDocument:
    """Parse PDF from in-memory bytes (for file uploads)."""
    import io

    pages = []
    metadata = {}

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        metadata = pdf.metadata or {}
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)

    full_text = "\n\n".join(pages)

    logger.info("Parsed %s: %d pages, %d chars", filename, len(pages), len(full_text))

    return ParsedDocument(
        filename=filename,
        pages=pages,
        full_text=full_text,
        page_count=len(pages),
        metadata=metadata,
    )
