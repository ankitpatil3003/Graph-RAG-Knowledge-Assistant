"""LLM-powered entity extraction from financial filing text."""

import json
import logging
from dataclasses import dataclass
from langchain_core.messages import HumanMessage
from app.llm.provider import get_llm
from app.observability.langfuse_client import get_langfuse_callback

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """Extract structured entities and relationships from this financial filing text.

Return a JSON object with:
{{
  "entities": [
    {{"name": "...", "type": "COMPANY|PERSON|METRIC|DATE|LOCATION|PRODUCT|REGULATION", "properties": {{}}}}
  ],
  "relationships": [
    {{"source": "entity_name", "target": "entity_name", "type": "REPORTED|LEADS|OPERATES_IN|REVENUE_OF|FILED|REGULATES|PRODUCES", "properties": {{}}}}
  ]
}}

Rules:
- Extract companies, executives, financial metrics (revenue, net income, EPS), dates, locations, products, and regulations
- For metrics, include "value" and "period" in properties
- Keep entity names consistent (e.g., always "Apple Inc." not sometimes "Apple")
- Only extract what is explicitly stated in the text

Text:
{text}

JSON:"""


@dataclass
class ExtractedEntity:
    name: str
    type: str
    properties: dict


@dataclass
class ExtractedRelationship:
    source: str
    target: str
    type: str
    properties: dict


@dataclass
class ExtractionResult:
    entities: list[ExtractedEntity]
    relationships: list[ExtractedRelationship]


async def extract_entities(text: str, trace_id: str | None = None) -> ExtractionResult:
    """Extract entities and relationships from text using LLM."""
    llm = get_llm()

    callbacks = []
    cb = get_langfuse_callback()
    if cb:
        callbacks.append(cb)

    prompt = EXTRACTION_PROMPT.format(text=text[:8000])  # limit to avoid token overflow

    response = await llm.ainvoke(
        [HumanMessage(content=prompt)],
        config={"callbacks": callbacks},
    )

    return _parse_extraction(response.content)


def _parse_extraction(raw: str) -> ExtractionResult:
    """Parse LLM JSON response into structured entities/relationships."""
    # Strip markdown code fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse entity extraction JSON: %s", raw[:200])
        return ExtractionResult(entities=[], relationships=[])

    entities = [
        ExtractedEntity(
            name=e["name"],
            type=e.get("type", "UNKNOWN"),
            properties=e.get("properties", {}),
        )
        for e in data.get("entities", [])
    ]

    relationships = [
        ExtractedRelationship(
            source=r["source"],
            target=r["target"],
            type=r.get("type", "RELATED_TO"),
            properties=r.get("properties", {}),
        )
        for r in data.get("relationships", [])
    ]

    logger.info("Extracted %d entities, %d relationships", len(entities), len(relationships))
    return ExtractionResult(entities=entities, relationships=relationships)
