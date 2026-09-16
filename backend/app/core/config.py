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
    # One origin, or several separated by commas (production and a preview URL).
    # "*" is refused: the API is called with credentials.
    frontend_origin: str = "http://localhost:5173"
    environment: Literal["local", "staging", "production", "test"] = "local"

    # --- Model provider (behind app/llm/gateway.py, D-026) ---
    gemini_api_key: SecretStr | None = None
    gemini_answer_model: str = "gemini-3.5-flash"        # answer generation
    gemini_fast_model: str = "gemini-3.5-flash-lite"     # query rewrite, grading, groundedness
    # Gemini 3 models think before answering by default, which costs latency and
    # output tokens. "minimal" keeps structured answers fast (D-026).
    gemini_thinking_level: str = "minimal"
    # Tried after the answer and fast models, comma separated. The free tier
    # limits requests per model per day, so a chain of models goes further (D-032).
    gemini_fallback_models: str = "gemini-3-flash-preview"
    gemini_embed_model: str = "gemini-embedding-001"
    embed_dim: int = 1536                                # must match chunk_embeddings.embedding
    # The free tier allows 100 embedded texts a minute, each text counted as a
    # request. Raise both for a paid key (D-033).
    embed_requests_per_minute: int = 100
    embed_batch_size: int = 100
    # A hard deadline per model call. A model that times out or hits its quota
    # is skipped for a cooldown and the next model in the chain is used (D-031, D-032).
    llm_timeout_seconds: float = 15.0
    model_cooldown_seconds: float = 120.0
    response_cache_entries: int = 512                    # in-process cache of identical model calls

    # --- Per-user rate limits (D-041) ---
    # Each question spends shared model quota, so one person or a looping script
    # must not be able to exhaust the day's quota for everyone.
    rate_limit_ask_per_minute: int = 6
    rate_limit_ask_per_hour: int = 60
    rate_limit_chat_per_minute: int = 10
    rate_limit_chat_per_hour: int = 120
    rate_limit_upload_per_minute: int = 10
    rate_limit_upload_per_hour: int = 60

    # --- Upload limits (D-041) ---
    max_docx_uncompressed_bytes: int = 200 * 1024 * 1024
    max_docx_entries: int = 5000
    max_pdf_pages: int = 1500
    max_passages_per_document: int = 3000

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
    def cors_origins(self) -> list[str]:
        origins = [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]
        if not origins or "*" in origins:
            raise ValueError("FRONTEND_ORIGIN must list explicit origins; '*' is not allowed with credentials")
        return origins

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
