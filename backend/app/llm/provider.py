"""LLM provider factory with OpenAI primary + free fallback."""

import logging
from langchain_core.language_models import BaseChatModel
from app.config import get_settings

logger = logging.getLogger(__name__)


def get_llm() -> BaseChatModel:
    """Return the active LLM based on config.

    Priority:
    1. OpenAI (if OPENAI_API_KEY is set)
    2. Fallback to Gemini or OpenRouter free tier
    """
    settings = get_settings()

    if settings.has_openai:
        return _build_openai(settings)

    if settings.llm_fallback_provider == "gemini":
        return _build_gemini(settings)

    return _build_openrouter(settings)


def _build_openai(settings) -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    logger.info("Using OpenAI: %s", settings.openai_model)
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0,
    )


def _build_gemini(settings) -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    if not settings.gemini_api_key:
        raise ValueError("No GEMINI_API_KEY set and Gemini is the fallback provider")

    logger.info("Using Gemini (free tier): %s", settings.gemini_model)
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0,
    )


def _build_openrouter(settings) -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    if not settings.openrouter_api_key:
        raise ValueError(
            "No OPENROUTER_API_KEY set and OpenRouter is the fallback provider"
        )

    logger.info("Using OpenRouter (free tier): %s", settings.openrouter_model)
    return ChatOpenAI(
        model=settings.openrouter_model,
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0,
    )


def get_eval_llm() -> BaseChatModel:
    """Return a higher-quota LLM for evaluation (gemini-2.0-flash: 15 RPM, 1500 RPD)."""
    settings = get_settings()

    if settings.has_openai:
        return _build_openai(settings)

    if settings.llm_fallback_provider == "gemini" and settings.gemini_api_key:
        from langchain_google_genai import ChatGoogleGenerativeAI

        logger.info("Using Gemini eval model: gemini-2.0-flash")
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=settings.gemini_api_key,
            temperature=0,
        )

    return _build_openrouter(settings)


def get_provider_info() -> dict:
    """Return metadata about the active LLM provider."""
    settings = get_settings()
    provider = settings.active_llm_provider
    model_map = {
        "openai": settings.openai_model,
        "gemini": settings.gemini_model,
        "openrouter": settings.openrouter_model,
    }
    return {
        "provider": provider,
        "model": model_map[provider],
        "is_free_tier": provider != "openai",
    }
