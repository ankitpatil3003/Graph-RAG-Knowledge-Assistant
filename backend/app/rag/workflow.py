"""LangGraph RAG workflow with graph-based retrieval."""

import json
import logging
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage
from app.llm.provider import get_llm
from app.observability.langfuse_client import get_langfuse, get_langfuse_callback

logger = logging.getLogger(__name__)


def _trace_span(name: str, metadata: dict | None = None):
    """Create a Langfuse span for non-LLM operations (retrieval, etc.)."""
    lf = get_langfuse()
    if lf is None:
        return None
    trace = lf.trace(name=name, metadata=metadata or {})
    return trace


# --- State ---


class RAGState(TypedDict):
    query: str
    entities: list[dict]
    subgraph: list[dict]
    chunks: list[str]
    answer: str
    trace_id: str | None


# --- Nodes ---


async def extract_entities(state: RAGState) -> RAGState:
    """Use LLM to extract entity names from the user query for graph lookup."""
    llm = get_llm()
    prompt = (
        "Extract key entity names from this query that could match nodes in a knowledge graph "
        "about financial filings. Return ONLY a JSON array of strings — just the names.\n"
        "Example: [\"Apple Inc.\", \"Q4 2024\", \"revenue\"]\n\n"
        f"Query: {state['query']}\n\nJSON array:"
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])

    # Parse the response
    raw = response.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        names = json.loads(raw)
        if isinstance(names, list):
            state["entities"] = [{"name": n} for n in names if isinstance(n, str)]
        else:
            state["entities"] = []
    except json.JSONDecodeError:
        logger.warning("Could not parse entity extraction: %s", raw[:200])
        state["entities"] = []

    logger.info("Extracted query entities: %s", [e["name"] for e in state["entities"]])
    return state


async def retrieve_graph_context(state: RAGState) -> RAGState:
    """Traverse Neo4j graph using extracted entities + keyword search."""
    from app.graph.neo4j_client import get_session

    trace = _trace_span("retrieve_graph", {"query": state["query"], "entities": [e.get("name") for e in state["entities"]]})

    subgraph = []
    async with get_session() as session:
        # 1. Direct entity match + 2-hop neighborhood with properties
        for entity in state["entities"]:
            name = entity.get("name", "")
            result = await session.run(
                """
                MATCH (n)
                WHERE NOT n:Chunk AND NOT n:Document
                  AND toLower(n.name) CONTAINS toLower($name)
                OPTIONAL MATCH (n)-[r]-(m)
                WHERE NOT m:Chunk AND NOT m:Document
                RETURN n.name AS source, type(r) AS rel, m.name AS target,
                       labels(n) AS source_labels, labels(m) AS target_labels,
                       properties(n) AS source_props, properties(m) AS target_props
                LIMIT 30
                """,
                name=name,
            )
            async for record in result:
                data = record.data()
                if data.get("source"):
                    subgraph.append(data)

        # 2. If no entity matches, do a broad keyword search on the query
        if not subgraph:
            keywords = state["query"].lower().split()
            for kw in keywords[:5]:
                if len(kw) < 3:
                    continue
                result = await session.run(
                    """
                    MATCH (n)
                    WHERE NOT n:Chunk AND NOT n:Document
                      AND toLower(n.name) CONTAINS $keyword
                    OPTIONAL MATCH (n)-[r]-(m)
                    WHERE NOT m:Chunk AND NOT m:Document
                    RETURN n.name AS source, type(r) AS rel, m.name AS target,
                           labels(n) AS source_labels, labels(m) AS target_labels,
                           properties(n) AS source_props, properties(m) AS target_props
                    LIMIT 20
                    """,
                    keyword=kw,
                )
                async for record in result:
                    data = record.data()
                    if data.get("source"):
                        subgraph.append(data)

    # Deduplicate
    seen = set()
    unique = []
    for item in subgraph:
        key = (item.get("source"), item.get("rel"), item.get("target"))
        if key not in seen:
            seen.add(key)
            unique.append(item)

    state["subgraph"] = unique[:50]
    logger.info("Retrieved %d graph triples", len(state["subgraph"]))

    if trace:
        trace.update(output={"triples_count": len(state["subgraph"])})

    return state


async def retrieve_chunks(state: RAGState) -> RAGState:
    """Retrieve relevant text chunks using keyword matching on stored Chunk nodes."""
    from app.graph.neo4j_client import get_session

    trace = _trace_span("retrieve_chunks", {"query": state["query"]})

    chunks = []
    keywords = state["query"].lower().split()
    # Use the longer keywords for matching
    search_terms = [kw for kw in keywords if len(kw) >= 3]

    if not search_terms:
        state["chunks"] = []
        return state

    async with get_session() as session:
        # Search chunks that contain any of the query keywords
        for term in search_terms[:5]:
            result = await session.run(
                """
                MATCH (c:Chunk)-[:CHUNK_OF]->(d:Document)
                WHERE toLower(c.text) CONTAINS $term
                RETURN c.text AS text, d.filename AS source, c.index AS idx
                LIMIT 5
                """,
                term=term,
            )
            async for record in result:
                chunks.append(record.data())

    # Deduplicate by text content
    seen = set()
    unique_chunks = []
    for c in chunks:
        if c["text"] not in seen:
            seen.add(c["text"])
            unique_chunks.append(c)

    state["chunks"] = [
        f"[{c.get('source', 'unknown')}] {c['text']}" for c in unique_chunks[:5]
    ]
    logger.info("Retrieved %d chunks", len(state["chunks"]))

    if trace:
        trace.update(output={"chunks_count": len(state["chunks"])})

    return state


async def generate_answer(state: RAGState) -> RAGState:
    """Generate final answer using graph context + chunks."""
    llm = get_llm()

    context_parts = []

    def _fmt_props(props: dict) -> str:
        """Format entity properties, excluding 'name' to avoid redundancy."""
        return ", ".join(
            f"{k}={v}" for k, v in props.items()
            if k != "name" and v
        )

    if state["subgraph"]:
        # Format graph triples readably, including entity properties
        triples = []
        for item in state["subgraph"]:
            src = item.get("source", "?")
            rel = item.get("rel", "?")
            tgt = item.get("target", "?")
            src_props = item.get("source_props", {})
            tgt_props = item.get("target_props", {})

            if tgt:
                line = f"  {src} --[{rel}]--> {tgt}"
                prop_parts = []
                if src_props:
                    p = _fmt_props(src_props)
                    if p:
                        prop_parts.append(f"[{src}: {p}]")
                if tgt_props:
                    p = _fmt_props(tgt_props)
                    if p:
                        prop_parts.append(f"[{tgt}: {p}]")
                if prop_parts:
                    line += "  " + " ".join(prop_parts)
                triples.append(line)
            else:
                labels = item.get("source_labels", [])
                line = f"  {src} ({', '.join(labels) if labels else 'entity'})"
                if src_props:
                    p = _fmt_props(src_props)
                    if p:
                        line += f"  [{p}]"
                triples.append(line)
        context_parts.append("Knowledge Graph:\n" + "\n".join(triples))

    if state["chunks"]:
        context_parts.append("Document Excerpts:\n" + "\n---\n".join(state["chunks"]))

    context = "\n\n".join(context_parts) if context_parts else "No context found."

    prompt = (
        "You are a financial analyst assistant. Answer the question using ONLY the provided context. "
        "If the context doesn't contain enough information, say so.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {state['query']}\n\n"
        "Answer:"
    )

    callbacks = []
    cb = get_langfuse_callback()
    if cb:
        callbacks.append(cb)

    response = await llm.ainvoke(
        [HumanMessage(content=prompt)],
        config={"callbacks": callbacks},
    )
    state["answer"] = response.content
    return state


# --- Graph ---


def build_rag_workflow() -> StateGraph:
    """Build the LangGraph RAG workflow."""
    workflow = StateGraph(RAGState)

    workflow.add_node("extract_entities", extract_entities)
    workflow.add_node("retrieve_graph", retrieve_graph_context)
    workflow.add_node("retrieve_chunks", retrieve_chunks)
    workflow.add_node("generate", generate_answer)

    workflow.add_edge(START, "extract_entities")
    workflow.add_edge("extract_entities", "retrieve_graph")
    workflow.add_edge("retrieve_graph", "retrieve_chunks")
    workflow.add_edge("retrieve_chunks", "generate")
    workflow.add_edge("generate", END)

    return workflow.compile()


rag_graph = build_rag_workflow()
