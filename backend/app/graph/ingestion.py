"""Graph ingestion — write extracted entities and relationships to Neo4j."""

import logging
from app.graph.neo4j_client import get_session
from app.graph.entities import ExtractionResult

logger = logging.getLogger(__name__)


def _sanitize_label(label: str) -> str:
    """Ensure Neo4j label/type is valid (alphanumeric + underscore only)."""
    sanitized = "".join(c if c.isalnum() or c == "_" else "_" for c in label)
    return sanitized or "UNKNOWN"


def _flatten_props(props: dict) -> dict:
    """Flatten properties to Neo4j-compatible primitives (str, int, float, bool)."""
    flat = {}
    for k, v in props.items():
        if isinstance(v, (str, int, float, bool)):
            flat[k] = v
        elif v is not None:
            flat[k] = str(v)
    return flat


async def ingest_to_graph(
    extraction: ExtractionResult,
    document_id: str,
    filename: str,
) -> dict:
    """Write entities and relationships to Neo4j."""
    stats = {"nodes_created": 0, "relationships_created": 0}

    async with get_session() as session:
        # Create document node
        await session.run(
            """
            MERGE (d:Document {id: $doc_id})
            SET d.filename = $filename, d.ingested_at = datetime()
            """,
            doc_id=document_id,
            filename=filename,
        )

        # Create entity nodes — label must be inlined, not parameterized
        for entity in extraction.entities:
            label = _sanitize_label(entity.type)
            flat_props = _flatten_props(entity.properties)

            query = f"""
                MERGE (e:{label} {{name: $name}})
                SET e += $props
                WITH e
                MATCH (d:Document {{id: $doc_id}})
                MERGE (e)-[:EXTRACTED_FROM]->(d)
                RETURN count(e) as created
            """
            result = await session.run(
                query,
                name=entity.name,
                props=flat_props,
                doc_id=document_id,
            )
            record = await result.single()
            if record:
                stats["nodes_created"] += record["created"]

        # Create relationships — type must be inlined
        for rel in extraction.relationships:
            rel_type = _sanitize_label(rel.type)
            flat_props = _flatten_props(rel.properties)

            query = f"""
                MATCH (a {{name: $source}})
                MATCH (b {{name: $target}})
                MERGE (a)-[r:{rel_type}]->(b)
                SET r += $props
                RETURN count(r) as created
            """
            result = await session.run(
                query,
                source=rel.source,
                target=rel.target,
                props=flat_props,
            )
            record = await result.single()
            if record:
                stats["relationships_created"] += record["created"]

    logger.info(
        "Ingested to graph: %d nodes, %d relationships",
        stats["nodes_created"],
        stats["relationships_created"],
    )
    return stats


async def store_chunks(
    chunks: list[dict],
    document_id: str,
) -> int:
    """Store text chunks as Chunk nodes linked to the Document."""
    count = 0
    async with get_session() as session:
        for chunk in chunks:
            await session.run(
                """
                MATCH (d:Document {id: $doc_id})
                CREATE (c:Chunk {
                    text: $text,
                    index: $index,
                    strategy: $strategy
                })
                CREATE (c)-[:CHUNK_OF]->(d)
                """,
                doc_id=document_id,
                text=chunk["text"],
                index=chunk["index"],
                strategy=chunk["strategy"],
            )
            count += 1

    logger.info("Stored %d chunks for document %s", count, document_id)
    return count
