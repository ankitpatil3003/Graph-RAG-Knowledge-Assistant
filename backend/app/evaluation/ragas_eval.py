"""Evaluation harness comparing chunking strategies.

Uses token-overlap scoring (no LLM calls, runs instantly):
- Faithfulness: Is the answer grounded in the provided context?
- Context Recall: Does the retrieved context cover the ground truth?
- Answer Relevancy: Does the answer address the question?
"""

import logging
import re

from app.evaluation.eval_dataset import EVAL_DATASET
from app.graph.neo4j_client import get_session

logger = logging.getLogger(__name__)

# Common stopwords to exclude from overlap scoring
STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "and", "but", "or", "nor", "not", "so", "yet", "both", "each",
    "few", "more", "most", "other", "some", "such", "no", "only", "own",
    "same", "than", "too", "very", "just", "because", "if", "when", "which",
    "who", "whom", "this", "that", "these", "those", "what", "how", "it",
    "its", "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
    "she", "her", "they", "them", "their",
}


def _tokenize(text: str) -> set[str]:
    """Lowercase, split into words, remove stopwords and short tokens."""
    words = set(re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", text.lower()))
    return words - STOPWORDS


def _overlap_score(source: set[str], target: set[str]) -> float:
    """Fraction of target tokens found in source. Returns 0-1."""
    if not target:
        return 0.0
    overlap = source & target
    return len(overlap) / len(target)


def _score_item(
    question: str,
    ground_truth: str,
    context_text: str,
    answer: str,
) -> dict[str, float]:
    """Score one Q&A pair using token overlap."""
    q_tokens = _tokenize(question)
    gt_tokens = _tokenize(ground_truth)
    ctx_tokens = _tokenize(context_text)
    ans_tokens = _tokenize(answer)

    # Faithfulness: how much of the answer is grounded in context
    faithfulness = _overlap_score(ctx_tokens, ans_tokens) if ans_tokens else 0.0

    # Context Recall: how much of the ground truth is covered by context
    context_recall = _overlap_score(ctx_tokens, gt_tokens) if gt_tokens else 0.0

    # Answer Relevancy: how much the answer addresses question + ground truth keywords
    relevancy_target = q_tokens | (gt_tokens - STOPWORDS)
    answer_relevancy = _overlap_score(ans_tokens, relevancy_target) if relevancy_target else 0.0

    return {
        "faithfulness": round(faithfulness, 4),
        "context_recall": round(context_recall, 4),
        "answer_relevancy": round(answer_relevancy, 4),
    }


async def _retrieve_chunks_by_strategy(
    query: str, strategy: str, keywords: list[str]
) -> list[str]:
    """Retrieve chunks stored with a specific chunking strategy."""
    chunks = []
    async with get_session() as session:
        for kw in keywords[:5]:
            if len(kw) < 3:
                continue
            result = await session.run(
                """
                MATCH (c:Chunk)-[:CHUNK_OF]->(d:Document)
                WHERE c.strategy = $strategy
                  AND toLower(c.text) CONTAINS toLower($keyword)
                RETURN c.text AS text, d.filename AS source
                LIMIT 5
                """,
                strategy=strategy,
                keyword=kw,
            )
            async for record in result:
                chunks.append(record["text"])

    return list(dict.fromkeys(chunks))[:5]


async def run_eval_for_strategy(strategy: str) -> dict:
    """Run evaluation for a single chunking strategy."""
    totals = {"faithfulness": 0.0, "context_recall": 0.0, "answer_relevancy": 0.0}
    count = 0

    for item in EVAL_DATASET:
        query = item["question"]
        gt = item["ground_truth"]
        keywords = item["context_keywords"]

        retrieved = await _retrieve_chunks_by_strategy(query, strategy, keywords)
        context_text = "\n---\n".join(retrieved) if retrieved else ""

        # For answer, we use a simple extractive approach: concatenate relevant chunks
        # This avoids LLM calls entirely while still testing retrieval quality
        answer = context_text if context_text else "No relevant context found."

        scores = _score_item(query, gt, context_text, answer)

        for metric in totals:
            totals[metric] += scores[metric]
        count += 1

        logger.info("Strategy=%s Q=%d scores=%s", strategy, count, scores)

    avg_scores = {k: round(v / max(count, 1), 4) for k, v in totals.items()}
    logger.info("Eval results for '%s': %s", strategy, avg_scores)
    return {"strategy": strategy, "scores": avg_scores, "num_questions": count}


async def run_full_evaluation() -> dict:
    """Run evaluation across all 3 chunking strategies and compare."""
    strategies = ["fixed", "semantic", "late"]
    results = []

    for strategy in strategies:
        logger.info("Running evaluation for strategy: %s", strategy)
        result = await run_eval_for_strategy(strategy)
        results.append(result)

    comparison = {
        "strategies": results,
        "metrics": ["faithfulness", "answer_relevancy", "context_recall"],
        "best_by_metric": {},
    }

    for metric in comparison["metrics"]:
        best_strategy = None
        best_score = -1
        for r in results:
            score = r["scores"].get(metric, 0)
            if isinstance(score, (int, float)) and score > best_score:
                best_score = score
                best_strategy = r["strategy"]
        if best_strategy:
            comparison["best_by_metric"][metric] = {
                "strategy": best_strategy,
                "score": best_score,
            }

    return comparison
