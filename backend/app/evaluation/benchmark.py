"""Benchmark: graph-enhanced retrieval vs dense-only (chunk-only) retrieval.

Fair comparison — both paths use only the raw query, no ground-truth leak:

- Dense path: keyword search on fixed-strategy chunks, ranked by keyword
  density, top-3 returned. Simulates standard top-k vector/keyword RAG.
- Graph path: entity node match → 2-hop traversal with properties →
  relationship chains across documents → top-2 fixed chunks as supplement.
  Surfaces structured data (numeric values) and cross-document connections
  that top-k chunk retrieval misses.

Measures recall: fraction of ground-truth tokens found in retrieved context.
"""

import logging
import re

from app.evaluation.eval_dataset import EVAL_DATASET
from app.graph.neo4j_client import get_session

logger = logging.getLogger(__name__)

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "have",
    "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "and", "but", "or", "not", "so", "if", "it", "its", "this", "that",
    "what", "how", "who", "which", "many", "much", "than",
}


def _tokenize(text: str) -> set[str]:
    words = set(re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", text.lower()))
    return words - STOPWORDS


def _extract_query_keywords(query: str) -> list[str]:
    """Extract search terms from the raw query (no LLM, no ground-truth leak)."""
    tokens = re.findall(r"[a-zA-Z0-9]+(?:\.[0-9]+)?", query)
    return [t for t in tokens if len(t) >= 3 and t.lower() not in STOPWORDS]


def _rank_chunks(chunks: list[str], keywords: list[str], top_k: int) -> list[str]:
    """Rank chunks by keyword density (hits / chunk length) and return top-k."""
    kw_lower = [k.lower() for k in keywords]

    def score(text: str) -> float:
        t = text.lower()
        hits = sum(1 for kw in kw_lower if kw in t)
        # Normalize by length so shorter, denser chunks rank higher
        return hits / max(len(t), 1) * 1000

    ranked = sorted(chunks, key=score, reverse=True)
    return ranked[:top_k]


async def _retrieve_graph_context(query: str) -> str:
    """Graph-enhanced: entity match + 2-hop traversal with properties + top-2 chunks."""
    query_kws = _extract_query_keywords(query)
    parts: list[str] = []

    async with get_session() as session:
        # 1. Match entity nodes by query keywords, traverse 2-hop neighborhood
        #    Include ALL properties (numeric values, periods, etc.)
        for kw in query_kws[:6]:
            result = await session.run(
                """
                MATCH (n)
                WHERE NOT n:Chunk AND NOT n:Document
                  AND toLower(n.name) CONTAINS toLower($keyword)
                OPTIONAL MATCH (n)-[r]-(m)
                WHERE NOT m:Chunk AND NOT m:Document
                OPTIONAL MATCH (m)-[r2]-(m2)
                WHERE NOT m2:Chunk AND NOT m2:Document AND m2 <> n
                RETURN n.name AS src, type(r) AS rel, m.name AS hop1,
                       labels(n) AS src_labels, properties(n) AS src_props,
                       type(r2) AS rel2, m2.name AS hop2,
                       properties(m) AS hop1_props, properties(m2) AS hop2_props
                LIMIT 50
                """,
                keyword=kw,
            )
            async for record in result:
                src = record.get("src", "")
                hop1 = record.get("hop1", "")
                hop2 = record.get("hop2", "")
                rel = record.get("rel", "")
                rel2 = record.get("rel2", "")
                src_props = record.get("src_props", {})
                hop1_props = record.get("hop1_props", {})
                hop2_props = record.get("hop2_props", {})

                if src:
                    prop_str = " ".join(
                        f"{k}:{v}" for k, v in src_props.items()
                        if v and k != "name"
                    )
                    parts.append(f"{src} {prop_str}".strip())
                if hop1 and rel:
                    prop_str = " ".join(
                        f"{k}:{v}" for k, v in hop1_props.items()
                        if v and k != "name"
                    )
                    parts.append(f"{src} {rel} {hop1} {prop_str}".strip())
                if hop2 and rel2:
                    prop_str = " ".join(
                        f"{k}:{v}" for k, v in hop2_props.items()
                        if v and k != "name"
                    )
                    parts.append(f"{hop1} {rel2} {hop2} {prop_str}".strip())

        # 2. Supplement with top-2 fixed-strategy chunks (limited, not exhaustive)
        all_chunks: list[str] = []
        for kw in query_kws[:3]:
            result = await session.run(
                """
                MATCH (c:Chunk)-[:CHUNK_OF]->(d:Document)
                WHERE c.strategy = 'fixed'
                  AND toLower(c.text) CONTAINS toLower($keyword)
                RETURN c.text AS text
                LIMIT 5
                """,
                keyword=kw,
            )
            async for record in result:
                all_chunks.append(record["text"])

        # Deduplicate and rank
        seen: set[str] = set()
        unique_chunks: list[str] = []
        for c in all_chunks:
            if c not in seen:
                seen.add(c)
                unique_chunks.append(c)
        parts.extend(_rank_chunks(unique_chunks, query_kws, top_k=2))

    return " ".join(parts)


async def _retrieve_chunks_only(query: str) -> str:
    """Dense-only: top-3 fixed-strategy chunks by keyword search. No graph."""
    query_kws = _extract_query_keywords(query)
    all_chunks: list[str] = []

    async with get_session() as session:
        for kw in query_kws[:6]:
            result = await session.run(
                """
                MATCH (c:Chunk)-[:CHUNK_OF]->(d:Document)
                WHERE c.strategy = 'fixed'
                  AND toLower(c.text) CONTAINS toLower($keyword)
                RETURN c.text AS text
                LIMIT 5
                """,
                keyword=kw,
            )
            async for record in result:
                all_chunks.append(record["text"])

    # Deduplicate
    seen: set[str] = set()
    unique: list[str] = []
    for c in all_chunks:
        if c not in seen:
            seen.add(c)
            unique.append(c)

    # Return top-3 by keyword density — simulates top-k vector retrieval
    return " ".join(_rank_chunks(unique, query_kws, top_k=3))


def _recall_score(retrieved_text: str, ground_truth: str) -> float:
    """Fraction of ground-truth tokens found in retrieved context."""
    retrieved_tokens = _tokenize(retrieved_text)
    gt_tokens = _tokenize(ground_truth)
    if not gt_tokens:
        return 0.0
    return len(retrieved_tokens & gt_tokens) / len(gt_tokens)


async def run_benchmark() -> dict:
    """Run graph-vs-dense benchmark across all eval questions."""
    graph_scores = []
    dense_scores = []
    per_question = []

    for item in EVAL_DATASET:
        query = item["question"]
        gt = item["ground_truth"]

        graph_ctx = await _retrieve_graph_context(query)
        dense_ctx = await _retrieve_chunks_only(query)

        graph_recall = _recall_score(graph_ctx, gt)
        dense_recall = _recall_score(dense_ctx, gt)

        graph_scores.append(graph_recall)
        dense_scores.append(dense_recall)

        per_question.append({
            "question": query,
            "graph_recall": round(graph_recall, 4),
            "dense_recall": round(dense_recall, 4),
            "improvement": round(graph_recall - dense_recall, 4),
        })

        logger.info(
            "Q: %s | graph=%.3f dense=%.3f",
            query[:50], graph_recall, dense_recall,
        )

    avg_graph = sum(graph_scores) / max(len(graph_scores), 1)
    avg_dense = sum(dense_scores) / max(len(dense_scores), 1)

    if avg_dense > 0:
        improvement_pct = ((avg_graph - avg_dense) / avg_dense) * 100
    else:
        improvement_pct = 100.0 if avg_graph > 0 else 0.0

    return {
        "graph_enhanced": {
            "avg_recall": round(avg_graph, 4),
            "method": "Entity match + 2-hop traversal + properties + top-2 chunks",
        },
        "dense_only": {
            "avg_recall": round(avg_dense, 4),
            "method": "Top-3 fixed-strategy chunks by keyword density",
        },
        "improvement_pct": round(improvement_pct, 1),
        "num_questions": len(EVAL_DATASET),
        "per_question": per_question,
    }
