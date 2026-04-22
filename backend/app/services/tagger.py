"""Auto-tagging via embedding-based keyword extraction (KeyBERT-lite).

Scores candidate n-grams by cosine similarity to the document embedding and
selects a diverse set via Maximal Marginal Relevance (MMR).
"""
from __future__ import annotations

import re
from collections import Counter

import numpy as np

from app.services.embeddings import embed_batch, embed_text

# Minimal English stopword list (enough for a first-pass keyword extractor).
_STOPWORDS = frozenset(
    """a an the and or but if while is are was were be been being do does did have has had
    this that these those i you he she it we they them his her its their our your my me us
    to of in on at for from by with as into onto than then there here about above below over
    under between out up down off again further once only own same so such no nor not very
    can will just should could would may might must shall also however therefore thus hence
    which who whom whose what when where why how does doing done isn aren wasn weren hasn
    haven hadn doesn didn won wouldn shouldn couldn mustn shan needn mightn daren""".split()
)

_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z\-']{1,}")


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _candidate_ngrams(tokens: list[str], ngram_range: tuple[int, int] = (1, 3)) -> list[str]:
    lo, hi = ngram_range
    n = len(tokens)
    candidates: list[str] = []
    for size in range(lo, hi + 1):
        for i in range(n - size + 1):
            gram = tokens[i : i + size]
            # Drop candidates containing only stopwords or with stopword edges
            if gram[0] in _STOPWORDS or gram[-1] in _STOPWORDS:
                continue
            if all(w in _STOPWORDS for w in gram):
                continue
            if any(len(w) < 2 for w in gram):
                continue
            candidates.append(" ".join(gram))
    return candidates


def _mmr(
    doc_vec: np.ndarray,
    cand_vecs: np.ndarray,
    candidates: list[str],
    top_k: int,
    diversity: float = 0.6,
) -> list[str]:
    """Maximal Marginal Relevance selection."""
    if len(candidates) == 0:
        return []
    top_k = min(top_k, len(candidates))

    sim_to_doc = cand_vecs @ doc_vec  # (N,)
    selected: list[int] = []
    remaining = list(range(len(candidates)))

    # Seed with highest-relevance candidate
    first = int(np.argmax(sim_to_doc))
    selected.append(first)
    remaining.remove(first)

    while len(selected) < top_k and remaining:
        sim_to_selected = cand_vecs[remaining] @ cand_vecs[selected].T  # (R, S)
        max_sim = sim_to_selected.max(axis=1)
        mmr_score = (1 - diversity) * sim_to_doc[remaining] - diversity * max_sim
        next_idx = remaining[int(np.argmax(mmr_score))]
        selected.append(next_idx)
        remaining.remove(next_idx)

    return [candidates[i] for i in selected]


def extract_keywords(
    text: str,
    top_k: int = 6,
    ngram_range: tuple[int, int] = (1, 2),
    diversity: float = 0.6,
) -> list[str]:
    """Return up to `top_k` diverse keyword tags for the document."""
    if not text or not text.strip():
        return []
    tokens = _tokenize(text)
    if len(tokens) < 10:
        return []

    raw = _candidate_ngrams(tokens, ngram_range)
    if not raw:
        return []

    # Keep the most frequent unique candidates (cap for perf)
    counts = Counter(raw)
    # Favor multi-word grams slightly when frequencies tie
    unique = sorted(
        counts.keys(),
        key=lambda k: (-counts[k], -len(k.split())),
    )[:200]

    doc_vec = np.asarray(embed_text(text), dtype=np.float32)
    cand_vecs = np.asarray(embed_batch(unique), dtype=np.float32)
    picks = _mmr(doc_vec, cand_vecs, unique, top_k=top_k, diversity=diversity)

    # Lightly format: title-case single-word, keep multi-word lowercase
    cleaned: list[str] = []
    seen: set[str] = set()
    for p in picks:
        k = p.strip().lower()
        if k in seen:
            continue
        seen.add(k)
        cleaned.append(k)
    return cleaned
