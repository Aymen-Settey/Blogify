from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Blogify"
    DEBUG: bool = True

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://blogify:blogify_secret_dev@postgres:5432/blogify"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ROOT_USER: str = "blogify_minio"
    MINIO_ROOT_PASSWORD: str = "blogify_minio_secret"
    MINIO_BUCKET: str = "blogify-media"
    MINIO_USE_SSL: bool = False

    # Qdrant
    QDRANT_HOST: str = "qdrant"
    QDRANT_PORT: int = 6333

    # Embedding model (used as part of the Qdrant collection name so upgrades are hot-swaps)
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_MODEL_TAG: str = "minilm"
    EMBEDDING_MODEL_VERSION: str = "v1"
    # Active collections — default to derived names, but overridable for cutover/rollback.
    POSTS_COLLECTION: str = "posts_minilm_v1"
    USERS_COLLECTION: str = "users_minilm_v1"

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # Ollama (local LLM)
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen2.5:1.5b-instruct"
    OLLAMA_TIMEOUT_SECONDS: int = 60

    # Retrieval tuning
    # Hybrid search: RRF fuses dense + BM25. Set HYBRID_SEARCH_ENABLED=false to fall back to dense-only.
    HYBRID_SEARCH_ENABLED: bool = True
    RRF_K: int = 60  # standard constant for reciprocal rank fusion
    BM25_INDEX_TTL_SECONDS: int = 300  # rebuild in-process BM25 index at most this often
    # Cross-encoder rerank: heavy model (~80MB) — lazy-loaded. Disabled by default on CPU-only boxes.
    RERANKER_ENABLED: bool = False
    RERANKER_MODEL_NAME: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RERANKER_TOP_K: int = 20  # how many candidates to rerank

    # Moderation — soft-flag threshold. Toxicity > threshold sets Post.is_flagged.
    MODERATION_THRESHOLD: float = 0.75

    # CLIP image search (Phase 4.3).
    # open_clip ViT-B-32 / openai → 512-dim vectors, ~350MB model download on first use.
    # Collection name is versioned by {tag}_{version} so cutovers are hot-swaps.
    IMAGE_SEARCH_ENABLED: bool = True
    CLIP_MODEL_NAME: str = "ViT-B-32"
    CLIP_PRETRAINED: str = "openai"
    CLIP_EMBEDDING_DIM: int = 512
    IMAGES_COLLECTION: str = "images_clip_vitb32_v1"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
