"""Language detection using lingua-language-detector.

Lazy singleton — the detector is heavy (~100MB) so we build it once.
Falls back to returning (None, 0.0) if the library is unavailable.
"""
from __future__ import annotations

import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

# ISO-639-1 codes we care about mapped to lingua Language enum members.
_SUPPORTED = ("en", "fr", "es", "de", "it", "pt", "ar", "zh", "ja", "ru")


@lru_cache(maxsize=1)
def _detector():
    try:
        from lingua import Language, LanguageDetectorBuilder
    except Exception as exc:  # noqa: BLE001
        logger.warning("[lang] lingua not importable: %s", exc)
        return None

    name_map = {
        "en": "ENGLISH", "fr": "FRENCH", "es": "SPANISH", "de": "GERMAN",
        "it": "ITALIAN", "pt": "PORTUGUESE", "ar": "ARABIC", "zh": "CHINESE",
        "ja": "JAPANESE", "ru": "RUSSIAN",
    }
    langs = []
    for code in _SUPPORTED:
        lang = getattr(Language, name_map[code], None)
        if lang is not None:
            langs.append(lang)
    if not langs:
        return None
    return LanguageDetectorBuilder.from_languages(*langs).build()


def detect_language(text: str) -> tuple[str | None, float]:
    """Return (iso_code, confidence) or (None, 0.0) if detection fails.

    `confidence` is in [0, 1] based on lingua's confidence value for the top language.
    """
    if not text or len(text.strip()) < 20:
        return None, 0.0

    det = _detector()
    if det is None:
        return None, 0.0

    try:
        confidences = det.compute_language_confidence_values(text[:2000])
        if not confidences:
            return None, 0.0
        top = confidences[0]
        iso = getattr(top.language, "iso_code_639_1", None)
        code = getattr(iso, "name", None)  # e.g. 'EN'
        if not code:
            return None, 0.0
        return code.lower(), float(top.value)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[lang] detection failed: %s", exc)
        return None, 0.0
