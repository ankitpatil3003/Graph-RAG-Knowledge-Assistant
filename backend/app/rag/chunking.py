"""Chunking strategies for RAGAS evaluation comparison.

Three strategies:
1. Fixed    — split by character count with overlap
2. Semantic — split by sentence boundaries, group by similarity
3. Late     — keep full document, chunk at retrieval time
"""

import logging
from dataclasses import dataclass
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    SentenceTransformersTokenTextSplitter,
)

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    text: str
    index: int
    strategy: str
    metadata: dict


def chunk_fixed(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200,
    metadata: dict | None = None,
) -> list[Chunk]:
    """Fixed-size character splitting with overlap."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    splits = splitter.split_text(text)

    return [
        Chunk(
            text=s,
            index=i,
            strategy="fixed",
            metadata={**(metadata or {}), "chunk_size": chunk_size, "overlap": overlap},
        )
        for i, s in enumerate(splits)
    ]


def chunk_semantic(
    text: str,
    max_chunk_size: int = 1500,
    metadata: dict | None = None,
) -> list[Chunk]:
    """Sentence-boundary splitting grouped into semantic blocks.

    Uses paragraph/sentence boundaries to create more meaningful chunks.
    """
    # Split on paragraph boundaries first, then merge small ones
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chunk_size and current:
            chunks.append(current)
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para

    if current:
        chunks.append(current)

    return [
        Chunk(
            text=c,
            index=i,
            strategy="semantic",
            metadata={**(metadata or {}), "max_chunk_size": max_chunk_size},
        )
        for i, c in enumerate(chunks)
    ]


def chunk_late(
    text: str,
    metadata: dict | None = None,
) -> list[Chunk]:
    """Late chunking — store full document as single chunk.

    Chunking happens at retrieval time based on the query context.
    """
    return [
        Chunk(
            text=text,
            index=0,
            strategy="late",
            metadata={**(metadata or {}), "full_document": True},
        )
    ]


def chunk_document(
    text: str,
    strategy: str = "fixed",
    metadata: dict | None = None,
    **kwargs,
) -> list[Chunk]:
    """Route to the appropriate chunking strategy."""
    strategies = {
        "fixed": chunk_fixed,
        "semantic": chunk_semantic,
        "late": chunk_late,
    }

    if strategy not in strategies:
        raise ValueError(f"Unknown strategy '{strategy}'. Use: {list(strategies.keys())}")

    chunks = strategies[strategy](text, metadata=metadata, **kwargs)
    logger.info("Chunked with '%s': %d chunks", strategy, len(chunks))
    return chunks
