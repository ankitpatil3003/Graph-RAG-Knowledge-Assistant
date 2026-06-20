"""Neo4j Aura connection manager."""

import logging
from contextlib import asynccontextmanager
from neo4j import AsyncGraphDatabase, AsyncDriver
from app.config import get_settings

logger = logging.getLogger(__name__)

_driver: AsyncDriver | None = None


async def get_driver() -> AsyncDriver:
    global _driver
    if _driver is None:
        settings = get_settings()
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_username, settings.neo4j_password),
        )
        await _driver.verify_connectivity()
        logger.info("Connected to Neo4j at %s", settings.neo4j_uri)
    return _driver


async def close_driver():
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None
        logger.info("Neo4j connection closed")


@asynccontextmanager
async def get_session():
    """Yield an async Neo4j session."""
    settings = get_settings()
    driver = await get_driver()
    async with driver.session(database=settings.neo4j_database) as session:
        yield session


async def health_check() -> bool:
    """Return True if Neo4j is reachable."""
    try:
        driver = await get_driver()
        await driver.verify_connectivity()
        return True
    except Exception as e:
        logger.error("Neo4j health check failed: %s", e)
        return False
