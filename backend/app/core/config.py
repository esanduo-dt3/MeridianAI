from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """The only place configuration is read. Missing required values fail at startup, not mid-request."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str = Field(pattern=r"^https://")
    supabase_publishable_key: SecretStr
    supabase_service_role_key: SecretStr
    frontend_origin: str = "http://localhost:5173"
    environment: Literal["local", "staging", "production", "test"] = "local"

    # --- Model provider (behind app/llm/gateway.py, D-026) ---
    gemini_api_key: SecretStr | None = None
    gemini_answer_model: str = "gemini-3.5-flash"        # answer generation
    gemini_fast_model: str = "gemini-3.5-flash-lite"     # query rewrite, grading, groundedness
    # Gemini 3 models think before answering by default, which costs latency and
    # output tokens. "minimal" keeps structured answers fast (D-026).
    gemini_thinking_level: str = "minimal"
    gemini_embed_model: str = "gemini-embedding-001"
    embed_dim: int = 1536                                # must match chunk_embeddings.embedding
    llm_timeout_seconds: float = 60.0
    response_cache_entries: int = 512                    # in-process cache of identical model calls

    # --- Reranking ---
    voyage_api_key: SecretStr | None = None
    voyage_rerank_model: str = "rerank-2.5"

    # --- Chunking (token budgets estimated from characters) ---
    chunk_target_tokens: int = 480
    chunk_max_tokens: int = 800
    chunk_overlap_tokens: int = 64
    chunk_min_tokens: int = 80

    # --- Retrieval confidence gate ---
    # Above the first, the reranker is sure enough that an LLM grade adds latency
    # and nothing else. Below the second, the result is plainly weak.
    rerank_confident_score: float = 0.50
    rerank_weak_score: float = 0.22
    retrieval_max_attempts: int = 2
    # Answers below this uncalibrated confidence are flagged for admin review.
    review_confidence_threshold: float = 0.35

    @property
    def supabase_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_issuer}/.well-known/jwks.json"

    @property
    def supabase_rest_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/rest/v1"

    @property
    def supabase_storage_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/storage/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
