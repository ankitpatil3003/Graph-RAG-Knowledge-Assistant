"""End-to-end ingestion pipeline: PDF → parse → chunk → extract → graph."""

import logging
import uuid
from app.ingestion.pdf_parser import parse_pdf_bytes, ParsedDocument
from app.rag.chunking import chunk_document, Chunk
from app.graph.entities import extract_entities
from app.graph.ingestion import ingest_to_graph, store_chunks
from app.observability.langfuse_client import get_langfuse_callback

logger = logging.getLogger(__name__)


async def ingest_pdf(
    content: bytes,
    filename: str,
    chunking_strategy: str = "fixed",
) -> dict:
    """Full ingestion pipeline for a PDF upload.

    Steps:
    1. Parse PDF → extract text
    2. Chunk text using selected strategy
    3. Extract entities with LLM
    4. Write entities + relationships to Neo4j
    5. Store chunks as Chunk nodes in Neo4j

    Returns summary stats.
    """
    document_id = str(uuid.uuid4())

    # 1. Parse PDF
    doc = parse_pdf_bytes(content, filename)
    logger.info("Parsed %s: %d pages", filename, doc.page_count)

    if not doc.full_text.strip():
        return {"error": "No text extracted from PDF", "document_id": document_id}

    # 2. Chunk
    chunks = chunk_document(doc.full_text, strategy=chunking_strategy)

    # 3. Extract entities (from full text, not individual chunks)
    extraction = await extract_entities(doc.full_text, trace_id=document_id)

    # 4. Ingest entities + relationships to Neo4j
    graph_stats = await ingest_to_graph(extraction, document_id, filename)

    # 5. Store chunks in Neo4j
    chunk_dicts = [
        {"text": c.text, "index": c.index, "strategy": c.strategy}
        for c in chunks
    ]
    chunks_stored = await store_chunks(chunk_dicts, document_id)

    return {
        "document_id": document_id,
        "filename": filename,
        "pages": doc.page_count,
        "chars": len(doc.full_text),
        "chunks": chunks_stored,
        "chunking_strategy": chunking_strategy,
        "entities": len(extraction.entities),
        "relationships": len(extraction.relationships),
        **graph_stats,
    }
