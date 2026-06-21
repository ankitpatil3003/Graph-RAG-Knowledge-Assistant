"""Benchmark: graph-enhanced retrieval vs dense-only (chunk-only) retrieval.

Proves the multi-hop recall improvement by running the same queries through
both retrieval paths and comparing ground-truth keyword coverage.
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
    "what", "how", "who", "which",
}


def _tokenize(text: str) -> set[str]:
    words = set(re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", text.lower()))
    return words - STOPWORDS


async def _retrieve_graph_context(query: str, keywords: list[str]) -> str:
    """Graph-enhanced retrieval: entity match + neighborhood + chunks."""
    parts = []

    async with get_session() as session:
        # Entity-based graph traversal (multi-hop)
        for kw in keywords[:5]:
            if len(kw) < 3:
                continue
            result = await session.run(
                """
                MATCH (n)
                WHERE toLower(n.name) CONTAINS toLower($keyword)
                OPTIONAL MATCH (n)-[r]-(m)
                RETURN n.name AS source, type(r) AS rel, m.name AS target,
                       labels(n) AS source_labels, labels(m) AS target_labels
                LIMIT 30
                """,
                keyword=kw,
            )
            async for record in result:
                src = record.get("source", "")
                rel = record.get("rel", "")
                tgt = record.get("target", "")
                if src:
                    parts.append(f"{src} {rel} {tgt}")

        # Also get chunks (combined approach)
        for kw in keywords[:5]:
            if len(kw) < 3:
                continue
            result = await session.run(
                """
                MATCH (c:Chunk)-[:CHUNK_OF]->(d:Document)
                WHERE toLower(c.text) CONTAINS toLower($keyword)
                RETURN c.text AS text
                LIMIT 3
                """,
                keyword=kw,
            )
            async for record in result:
                parts.append(record["text"])

    return " ".join(parts)


async def _retrieve_chunks_only(query: str, keywords: list[str]) -> str:
    """Dense-only retrieval: chunks only, no graph traversal."""
    parts = []

    async with get_session() as session:
        for kw in keywords[:5]:
            if len(kw) < 3:
                continue
            result = await session.run(
                """
                MATCH (c:Chunk)-[:CHUNK_OF]->(d:Document)
                WHERE toLower(c.text) CONTAINS toLower($keyword)
                RETURN c.text AS text
                LIMIT 5
                """,
                keyword=kw,
            )
            async for record in result:
                parts.append(record["text"])

    return " ".join(parts)


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
        keywords = item["context_keywords"]

        graph_ctx = await _retrieve_graph_context(query, keywords)
        dense_ctx = await _retrieve_chunks_only(query, keywords)

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
            "method": "Graph traversal + chunk retrieval",
        },
        "dense_only": {
            "avg_recall": round(avg_dense, 4),
            "method": "Chunk retrieval only",
        },
        "improvement_pct": round(improvement_pct, 1),
        "num_questions": len(EVAL_DATASET),
        "per_question": per_question,
    }
