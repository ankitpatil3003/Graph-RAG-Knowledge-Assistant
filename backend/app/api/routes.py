"""API routes for the Graph RAG Knowledge Assistant."""

from fastapi import APIRouter, HTTPException
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


@router.get("/provider")
async def provider_info():
    """Return current LLM provider details."""
    return get_provider_info()
