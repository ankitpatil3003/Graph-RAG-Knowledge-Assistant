"""LangGraph RAG workflow with graph-based retrieval."""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage
from app.llm.provider import get_llm
from app.observability.langfuse_client import get_langfuse_callback


# --- State ---


class RAGState(TypedDict):
    query: str
    entities: list[dict]  # Extracted entities from query
    subgraph: list[dict]  # Retrieved graph context (nodes + relationships)
    chunks: list[str]  # Retrieved text chunks
    answer: str
    trace_id: str | None


# --- Nodes ---


async def extract_entities(state: RAGState) -> RAGState:
    """Use LLM to extract entities from the user query for graph lookup."""
    llm = get_llm()
    prompt = (
        "Extract key entities (companies, people, financial metrics, dates) "
        "from this query. Return as JSON list of {name, type} objects.\n\n"
        f"Query: {state['query']}"
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    # TODO: parse structured output from LLM response
    state["entities"] = []  # placeholder
    return state


async def retrieve_graph_context(state: RAGState) -> RAGState:
    """Traverse Neo4j graph using extracted entities for multi-hop retrieval."""
    from app.graph.neo4j_client import get_session

    subgraph = []
    async with get_session() as session:
        for entity in state["entities"]:
            # Multi-hop: find entity and its 2-hop neighborhood
            result = await session.run(
                """
                MATCH (n)-[r*1..2]-(m)
                WHERE n.name = $name
                RETURN n, r, m LIMIT 50
                """,
                name=entity.get("name", ""),
            )
            records = [record.data() async for record in result]
            subgraph.extend(records)

    state["subgraph"] = subgraph
    return state


async def retrieve_chunks(state: RAGState) -> RAGState:
    """Retrieve relevant text chunks (vector similarity or keyword)."""
    # TODO: implement chunking strategy (fixed / semantic / late chunking)
    # This will query Supabase pgvector or Neo4j vector index
    state["chunks"] = []
    return state


async def generate_answer(state: RAGState) -> RAGState:
    """Generate final answer using graph context + chunks."""
    llm = get_llm()

    context_parts = []
    if state["subgraph"]:
        context_parts.append(f"Graph context:\n{state['subgraph']}")
    if state["chunks"]:
        context_parts.append(f"Document chunks:\n{chr(10).join(state['chunks'])}")

    context = "\n\n".join(context_parts) if context_parts else "No context found."

    prompt = (
        f"Answer the following question using the provided context.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {state['query']}\n\n"
        f"Answer:"
    )

    callbacks = []
    cb = get_langfuse_callback(trace_name="rag_generate", trace_id=state.get("trace_id"))
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


# Compiled graph — importable
rag_graph = build_rag_workflow()
