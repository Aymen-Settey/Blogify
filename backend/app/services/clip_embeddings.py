"""CLIP (open_clip) embedding service for cross-modal text <-> image search.

Lazy-loads a single CLIP model and tokenizer. Produces L2-normalized 512-dim
vectors in a shared text/image space so cosine search works in either direction.

Kept deliberately tolerant: if the model fails to load (CPU box w/o network
to download weights on first use), callers get `None` and should skip indexing
rather than failing the whole request.
"""
from __future__ import annotations

import io
import logging
import threading
from functools import lru_cache

import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)

_model_lock = threading.Lock()
_model = None
_preprocess = None
_tokenizer = None
_device = "cpu"


def _load() -> bool:
    """Load the CLIP model + preprocessor + tokenizer once. Returns True on success."""
    global _model, _preprocess, _tokenizer, _device
    if _model is not None:
        return True
    with _model_lock:
        if _model is not None:
            return True
        try:
            import torch
            import open_clip

            settings = get_settings()
            _device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(
                "Loading CLIP model %s/%s on %s",
                settings.CLIP_MODEL_NAME,
                settings.CLIP_PRETRAINED,
                _device,
            )
            model, _, preprocess = open_clip.create_model_and_transforms(
                settings.CLIP_MODEL_NAME,
                pretrained=settings.CLIP_PRETRAINED,
                device=_device,
                force_quick_gelu=settings.CLIP_PRETRAINED == "openai",
            )
            model.eval()
            tokenizer = open_clip.get_tokenizer(settings.CLIP_MODEL_NAME)
            _model, _preprocess, _tokenizer = model, preprocess, tokenizer
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("CLIP model load failed: %s", exc)
            return False


def clip_dim() -> int:
    return int(get_settings().CLIP_EMBEDDING_DIM)


def embed_text(text: str) -> list[float] | None:
    """Encode a text query into the CLIP space."""
    if not text or not text.strip():
        return None
    if not _load():
        return None
    try:
        import torch

        with torch.no_grad():
            tokens = _tokenizer([text]).to(_device)
            feats = _model.encode_text(tokens)
            feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-9)
        vec = feats[0].cpu().numpy().astype(np.float32).tolist()
        return vec
    except Exception as exc:  # noqa: BLE001
        logger.warning("CLIP embed_text failed: %s", exc)
        return None


def embed_image_bytes(data: bytes) -> list[float] | None:
    """Encode image bytes (PNG/JPEG/WebP/GIF) into the CLIP space."""
    if not data:
        return None
    if not _load():
        return None
    try:
        import torch
        from PIL import Image

        with Image.open(io.BytesIO(data)) as img:
            img = img.convert("RGB")
            tensor = _preprocess(img).unsqueeze(0).to(_device)
        with torch.no_grad():
            feats = _model.encode_image(tensor)
            feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-9)
        vec = feats[0].cpu().numpy().astype(np.float32).tolist()
        return vec
    except Exception as exc:  # noqa: BLE001
        logger.warning("CLIP embed_image failed: %s", exc)
        return None


@lru_cache(maxsize=128)
def embed_text_cached(text: str) -> tuple[float, ...] | None:
    """Cache short repeatable queries (e.g. "cat", "chart")."""
    vec = embed_text(text)
    return tuple(vec) if vec is not None else None
