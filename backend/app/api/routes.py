"""API routes for the Graph RAG Knowledge Assistant."""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from app.rag.workflow import rag_graph
from app.llm.provider import get_provider_info
from app.graph.neo4j_client import health_check as neo4j_health
from app.observability.langfuse_client import get_langfuse

router = APIRouter()


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
    file: UploadFile = File(...),
    strategy: str = Query("fixed", enum=["fixed", "semantic", "late"]),
):
    """Upload a PDF filing and ingest it into the knowledge graph."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    from app.ingestion.pipeline import ingest_pdf

    content = await file.read()
    try:
        result = await ingest_pdf(content, file.filename, chunking_strategy=strategy)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    return result


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
