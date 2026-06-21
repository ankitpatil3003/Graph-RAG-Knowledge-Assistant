"""API routes for the Graph RAG Knowledge Assistant."""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from app.rag.workflow import rag_graph
from app.llm.provider import get_provider_info
from app.graph.neo4j_client import health_check as neo4j_health
from app.observability.langfuse_client import get_langfuse

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory ingestion job store
# ---------------------------------------------------------------------------

_ingestion_jobs: dict[str, dict] = {}


async def _run_ingestion_job(
    job_id: str, content: bytes, filename: str, strategy: str
) -> None:
    """Background coroutine that runs the ingestion pipeline for one file."""
    from app.ingestion.pipeline import ingest_pdf

    _ingestion_jobs[job_id]["status"] = "processing"
    try:
        result = await ingest_pdf(content, filename, chunking_strategy=strategy)
        _ingestion_jobs[job_id].update(status="completed", result=result)
    except Exception as e:
        logger.exception("Ingestion failed for %s", filename)
        _ingestion_jobs[job_id].update(status="failed", error=str(e))


class QueryRequest(BaseModel):
    query: str
    session_id: str | None = None


class QueryResponse(BaseModel):
    answer: str
    provider: dict
    entities: list[dict]
    sources: list[dict]


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Run a RAG query through the LangGraph workflow."""
    try:
        result = await rag_graph.ainvoke(
            {
                "query": request.query,
                "entities": [],
                "subgraph": [],
                "chunks": [],
                "answer": "",
                "trace_id": request.session_id,
            }
        )
        return QueryResponse(
            answer=result["answer"],
            provider=get_provider_info(),
            entities=result["entities"],
            sources=result["subgraph"][:10],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health():
    """Health check for all services."""
    neo4j_ok = await neo4j_health()
    langfuse_ok = get_langfuse() is not None
    provider = get_provider_info()

    return {
        "status": "ok" if neo4j_ok else "degraded",
        "services": {
            "neo4j": "connected" if neo4j_ok else "disconnected",
            "langfuse": "connected" if langfuse_ok else "disabled",
            "llm": provider,
        },
    }


@router.post("/ingest")
async def ingest(
    files: list[UploadFile] = File(...),
    strategy: str = Query("fixed", enum=["fixed", "semantic", "late"]),
):
    """Upload one or more PDF filings and ingest them as background tasks.

    Returns a list of job descriptors immediately. Poll GET /ingest/status/{job_id}
    for progress.
    """
    jobs = []
    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            jobs.append({"filename": file.filename, "error": "Not a PDF"})
            continue

        content = await file.read()
        job_id = str(uuid.uuid4())
        _ingestion_jobs[job_id] = {
            "job_id": job_id,
            "filename": file.filename,
            "status": "queued",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "result": None,
            "error": None,
        }
        asyncio.create_task(_run_ingestion_job(job_id, content, file.filename, strategy))
        jobs.append({"job_id": job_id, "filename": file.filename, "status": "queued"})

    return {"jobs": jobs}


@router.get("/ingest/status/{job_id}")
async def ingest_status(job_id: str):
    """Poll the status of a single ingestion job."""
    job = _ingestion_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/ingest/jobs")
async def ingest_jobs():
    """List all ingestion jobs (most recent first)."""
    sorted_jobs = sorted(
        _ingestion_jobs.values(),
        key=lambda j: j.get("submitted_at", ""),
        reverse=True,
    )
    return {"jobs": sorted_jobs}


@router.get("/graph")
async def get_graph(limit: int = Query(100, le=500)):
    """Return nodes and edges for graph visualization."""
    from app.graph.neo4j_client import get_session

    async with get_session() as session:
        # Get nodes (excluding Chunk nodes to keep viz clean)
        node_result = await session.run(
            """
            MATCH (n)
            WHERE NOT n:Chunk
            RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS props
            LIMIT $limit
            """,
            limit=limit,
        )
        nodes = [
            {
                "id": str(record["id"]),
                "label": record["props"].get("name", record["props"].get("filename", "?")),
                "type": record["labels"][0] if record["labels"] else "Unknown",
                "properties": record["props"],
            }
            async for record in node_result
        ]

        # Get edges
        edge_result = await session.run(
            """
            MATCH (a)-[r]->(b)
            WHERE NOT a:Chunk AND NOT b:Chunk
            RETURN elementId(a) AS source, elementId(b) AS target, type(r) AS type
            LIMIT $limit
            """,
            limit=limit,
        )
        edges = [
            {
                "source": str(record["source"]),
                "target": str(record["target"]),
                "type": record["type"],
            }
            async for record in edge_result
        ]

    return {"nodes": nodes, "edges": edges}


@router.post("/evaluate")
async def run_evaluation(
    strategy: str = Query(None, enum=["fixed", "semantic", "late"]),
):
    """Run RAGAS evaluation. Pass strategy for single, omit for all 3."""
    from app.evaluation.ragas_eval import run_eval_for_strategy, run_full_evaluation

    try:
        if strategy:
            result = await run_eval_for_strategy(strategy)
        else:
            result = await run_full_evaluation()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    return result


@router.post("/benchmark")
async def run_benchmark():
    """Run graph-vs-dense retrieval benchmark."""
    from app.evaluation.benchmark import run_benchmark as _run_benchmark

    try:
        result = await _run_benchmark()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    return result


@router.get("/provider")
async def provider_info():
    """Return current LLM provider details."""
    return get_provider_info()
