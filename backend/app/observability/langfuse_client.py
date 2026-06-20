"""Langfuse observability integration."""

import logging
from langfuse import Langfuse
from langfuse.langchain import CallbackHandler
from app.config import get_settings

logger = logging.getLogger(__name__)

_langfuse: Langfuse | None = None


def get_langfuse() -> Langfuse | None:
    """Return Langfuse client, or None if not configured."""
    global _langfuse
    settings = get_settings()

    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        logger.warning("Langfuse not configured — tracing disabled")
        return None

    if _langfuse is None:
        _langfuse = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
        logger.info("Langfuse initialized at %s", settings.langfuse_host)

    return _langfuse


def get_langfuse_callback(**kwargs) -> CallbackHandler | None:
    """Return a LangChain callback handler for Langfuse tracing.

    Pass trace metadata via kwargs: trace_name, user_id, session_id, etc.
    """
    settings = get_settings()

    if not settings.langfuse_public_key:
        return None

    return CallbackHandler(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_host,
        **kwargs,
    )


def flush():
    """Flush pending Langfuse events."""
    if _langfuse is not None:
        _langfuse.flush()
