from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # --- LLM ---
    openai_api_key: str = ""
    gemini_api_key: str = ""
    openrouter_api_key: str = ""
    # Which fallback to use when OpenAI key is missing: "gemini" or "openrouter"
    llm_fallback_provider: str = "gemini"
    # Model names
    openai_model: str = "gpt-4.1-nano"
    gemini_model: str = "gemini-2.5-flash"
    openrouter_model: str = "deepseek/deepseek-r1:free"

    # --- Neo4j ---
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_username: str = "neo4j"
    neo4j_password: str = ""
    neo4j_database: str = "neo4j"

    # --- Supabase ---
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # --- Langfuse ---
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    # --- App ---
    app_name: str = "Graph RAG Knowledge Assistant"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def active_llm_provider(self) -> str:
        if self.has_openai:
            return "openai"
        return self.llm_fallback_provider


@lru_cache
def get_settings() -> Settings:
    return Settings()
