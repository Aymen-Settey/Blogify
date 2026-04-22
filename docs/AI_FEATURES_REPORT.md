# Blogify — AI Features Report

> A comprehensive guide to every AI and machine-learning capability in the platform.

---

## Table of Contents

1. [Text Embeddings](#1-text-embeddings)
2. [Vector Store (Qdrant)](#2-vector-store-qdrant)
3. [ML Post-Processing Pipeline](#3-ml-post-processing-pipeline)
4. [Extractive Summarization](#4-extractive-summarization)
5. [Auto-Tagging (KeyBERT-lite with MMR)](#5-auto-tagging-keybert-lite-with-mmr)
6. [Content Moderation (Toxicity Scoring)](#6-content-moderation-toxicity-scoring)
7. [Language Detection](#7-language-detection)
8. [Duplicate / Plagiarism Detection](#8-duplicate--plagiarism-detection)
9. [BM25 Lexical Search Index](#9-bm25-lexical-search-index)
10. [Hybrid Semantic Search (RRF + Cross-Encoder Reranking)](#10-hybrid-semantic-search-rrf--cross-encoder-reranking)
11. [Personalized "For You" Feed](#11-personalized-for-you-feed)
12. [User Interest Vector](#12-user-interest-vector)
13. [Similar Posts Discovery](#13-similar-posts-discovery)
14. [CLIP Image Embeddings](#14-clip-image-embeddings)
15. [Image Vector Index & Search](#15-image-vector-index--search)
16. [AI Writing Assistant (Draft Suggestions)](#16-ai-writing-assistant-draft-suggestions)
17. [Post Q&A ("Ask This Post")](#17-post-qa-ask-this-post)
18. [Contextual Ad Matching](#18-contextual-ad-matching)
19. [AI Explanation UI](#19-ai-explanation-ui)
20. [Prometheus ML Metrics](#20-prometheus-ml-metrics)
21. [Offline Retrieval Evaluation](#21-offline-retrieval-evaluation)
22. [Backfill Scripts](#22-backfill-scripts)
23. [Models & Dependencies Summary](#23-models--dependencies-summary)

---

## 1. Text Embeddings

**Purpose:** Converts text into 384-dimensional dense vectors for semantic similarity — the backbone model powering nearly every other AI feature.

| Detail | Value |
|---|---|
| **Model** | `sentence-transformers/all-MiniLM-L6-v2` (384-dim, ~22 MB, CPU) |
| **Libraries** | `sentence-transformers`, `numpy` |
| **File** | `backend/app/services/embeddings.py` |

**How it works:**
- Thread-safe lazy singleton — the model is loaded once and shared across workers.
- Provides `embed_text()`, `embed_batch()`, `average_vectors()` (L2-normalized mean-pool), and `embed_cached()` (LRU-cached for repeated short strings).
- All output vectors are L2-normalized for cosine similarity.
- Called internally by tasks, routers, and other services — not directly exposed via API.

---

## 2. Vector Store (Qdrant)

**Purpose:** Stores and retrieves embedding vectors for semantic similarity search across posts and users.

| Detail | Value |
|---|---|
| **Tech** | Qdrant vector database, cosine distance |
| **Collections** | `posts` (384-dim) and `users` (384-dim) |
| **File** | `backend/app/services/vector_store.py` |

**How it works:**
- The `posts` collection stores per-post vectors with payload metadata: `author_id`, `field`, `language`, `tags`, `published_at_ts`, `title`, `slug`.
- The `users` collection stores per-user interest vectors with `updated_ts`.
- Supports filtering by author, field, and language. Can exclude already-seen post IDs.
- Called by Celery tasks (upsert on publish) and routers (query on search/recommendation).

---

## 3. ML Post-Processing Pipeline

**Purpose:** A full background pipeline that runs every time a post is published or edited, handling text extraction, embedding, summarization, tagging, language detection, duplicate detection, and toxicity scoring.

| Detail | Value |
|---|---|
| **Task** | `tasks.process_post_ml` (Celery) |
| **File** | `backend/app/tasks/ml_tasks.py` |
| **Trigger** | Fired on post create/update when status is `published` |
| **Retry** | 3 retries with 30-second exponential backoff |

**Pipeline steps:**
1. **Text extraction** — Recursively extracts plain text from Tiptap JSON (`text_extract.py`).
2. **Language detection** — Auto-detects language; overrides only when confidence > 0.8.
3. **Embedding** — Embeds `title + body` with MiniLM.
4. **Duplicate detection** — Searches Qdrant for >0.92 cosine similarity with a different author → sets `duplicate_of_id`.
5. **Summarization** — Generates a 3-sentence extractive summary (if no user-provided summary exists).
6. **Auto-tagging** — Extracts 6 diverse keyword tags via embedding-based ranking.
7. **Toxicity scoring** — Scores content [0, 1]; sets `is_flagged` if above threshold.
8. **Vector upsert** — Stores the embedding in Qdrant (published) or deletes it (unpublished/archived).

---

## 4. Extractive Summarization

**Purpose:** Generates a concise 3-sentence summary for posts that don't have a user-provided one.

| Detail | Value |
|---|---|
| **Algorithm** | Embedding-based sentence extraction |
| **File** | `backend/app/services/summarizer.py` |
| **Trigger** | Called inside `tasks.process_post_ml` |

**How it works:**
1. Splits the post body into individual sentences.
2. Embeds each sentence with MiniLM.
3. Computes the document centroid (mean of all sentence vectors).
4. Picks the top-3 sentences by cosine similarity to the centroid, preserving original order.
5. Caps the result at 400 characters.

---

## 5. Auto-Tagging (KeyBERT-lite with MMR)

**Purpose:** Extracts 6 diverse keyword tags from post content using embedding-based ranking with diversity enforcement.

| Detail | Value |
|---|---|
| **Algorithm** | Embedding cosine ranking + Maximal Marginal Relevance |
| **File** | `backend/app/services/tagger.py` |
| **Trigger** | Called inside `tasks.process_post_ml` → stored in `Post.auto_tags` |

**How it works:**
1. Tokenizes the post and generates 1-gram and 2-gram candidates, filtering stopwords.
2. Keeps the top 200 candidates by frequency.
3. Embeds all candidates + the full document.
4. Ranks candidates by cosine similarity to the document embedding.
5. Selects the top 6 via **Maximal Marginal Relevance** (λ = 0.6) to ensure tag diversity.

---

## 6. Content Moderation (Toxicity Scoring)

**Purpose:** Scores post content for toxicity on a [0, 1] scale. Posts exceeding the threshold are soft-flagged for editorial review — never auto-blocked.

| Detail | Value |
|---|---|
| **Model** | `unitary/toxic-bert` (HuggingFace `transformers` pipeline, CPU) |
| **Fallback** | Heuristic keyword-list scoring if the model is unavailable |
| **File** | `backend/app/services/moderation.py` |
| **Trigger** | Called inside `tasks.process_post_ml` |

**How it works:**
- Examines 6 toxic-bert labels: `toxic`, `severe_toxic`, `obscene`, `threat`, `insult`, `identity_hate`.
- Takes the maximum score across all labels.
- Truncates input to 1500 characters / 512 tokens.
- Sets `Post.toxicity_score` and `Post.is_flagged`.
- **Heuristic fallback:** first keyword hit → 0.5, each additional → +0.15.

---

## 7. Language Detection

**Purpose:** Automatically detects the language of a post's content and sets the `Post.language` field.

| Detail | Value |
|---|---|
| **Library** | `lingua-language-detector` (statistical, ~100 MB) |
| **Supported languages** | en, fr, es, de, it, pt, ar, zh, ja, ru |
| **File** | `backend/app/services/language.py` |
| **Trigger** | Called inside `tasks.process_post_ml` |

**How it works:**
- Lazy singleton detector instance.
- Examines the first 2000 characters of the post body.
- Returns `(iso_code, confidence)`.
- Only overrides the existing language when confidence > 0.8 and the current value is `"en"` (default).

---

## 8. Duplicate / Plagiarism Detection

**Purpose:** Flags posts that are near-duplicates of existing content from a different author — an informational flag, not a publishing block.

| Detail | Value |
|---|---|
| **Threshold** | >0.92 cosine similarity |
| **File** | `backend/app/tasks/ml_tasks.py` (within `process_post_ml`) |
| **Trigger** | Part of the ML pipeline — runs on every publish |

**How it works:**
1. After embedding the post, searches Qdrant for the top-3 most similar posts (excluding itself).
2. If any match has a cosine score > 0.92 **and** a different `author_id`, sets `Post.duplicate_of_id` to that post's ID.
3. This flag is surfaced in the admin duplicate review panel (`GET /api/posts/admin/duplicates`).

---

## 9. BM25 Lexical Search Index

**Purpose:** An in-memory BM25 keyword index over all published posts, providing traditional lexical search alongside dense semantic search.

| Detail | Value |
|---|---|
| **Libraries** | `bm25s`, optional `PyStemmer` (English stemmer) |
| **File** | `backend/app/services/bm25_index.py` |
| **Refresh interval** | Every 300 seconds (configurable via `BM25_INDEX_TTL_SECONDS`) |

**How it works:**
- Pulls all published posts from PostgreSQL on first query or after TTL expiry.
- Tokenizes with stemming + stopword removal.
- Builds the BM25 index in memory.
- Post-filters results by `field` and `language` after scoring.
- Thread-safe with a lock to prevent concurrent rebuilds.

---

## 10. Hybrid Semantic Search (RRF + Cross-Encoder Reranking)

**Purpose:** Combines dense semantic search with lexical BM25 search via Reciprocal Rank Fusion, optionally followed by cross-encoder reranking for maximum relevance.

| Detail | Value |
|---|---|
| **Reranker model** | `cross-encoder/ms-marco-MiniLM-L-6-v2` (configurable via `RERANKER_MODEL_NAME`) |
| **File** | `backend/app/services/hybrid_search.py` |
| **Endpoint** | `GET /api/posts/search/semantic?q=...&limit=20&field=&language=` |
| **Feature flags** | `HYBRID_SEARCH_ENABLED`, `RERANKER_ENABLED` |

**Algorithm:**
1. **Dense retrieval:** Embed query with MiniLM → ANN search in Qdrant → top N results.
2. **Lexical retrieval:** BM25 search → top N results.
3. **RRF fusion:** Combines both ranked lists using Reciprocal Rank Fusion:

$$\text{score}(d) = \sum_{r \in \text{rankers}} \frac{1}{k + \text{rank}_r(d)}$$

4. **Cross-encoder reranking** (optional): Reranks the top-K fused results with a cross-encoder model for fine-grained relevance.

Each result includes an `explanation` dict with `rrf`, `dense`, `bm25`, `dense_rank`, `bm25_rank`, and `rerank` scores for transparency.

---

## 11. Personalized "For You" Feed

**Purpose:** Generates a personalized content feed by combining semantic similarity with freshness, engagement quality, and author diversity.

| Detail | Value |
|---|---|
| **Files** | `backend/app/services/ranker.py`, `backend/app/routers/recommendations.py` |
| **Endpoint** | `GET /api/recommendations/for-you?limit=20&field=&language=` |

**Algorithm:**

$$\text{score} = 1.0 \cdot \text{dense} + 0.25 \cdot \text{freshness} + 0.20 \cdot \text{quality}$$

- **Freshness:** Exponential decay with a 30-day half-life.
- **Quality:** $\min\!\left(1,\ \frac{\ln(1 + \text{engagement})}{\ln(101)}\right)$
- **Diversity:** MMR author-diversification pass — greedy selection with a 0.2 penalty per repeated author.

**Cold start:** If the user has no interactions, falls back to popular recent posts sorted by likes + recency.

---

## 12. User Interest Vector

**Purpose:** Builds a personalized interest profile vector for each user from their interaction history, powering the "For You" feed.

| Detail | Value |
|---|---|
| **Task** | `tasks.update_user_vector` (Celery) |
| **File** | `backend/app/tasks/ml_tasks.py` |
| **Trigger** | Fired on user like or bookmark |

**How it works:**
1. Retrieves vectors of the user's last 50 liked + 50 bookmarked posts from Qdrant.
2. Mean-pools all vectors and L2-normalizes the result.
3. Stores the interest vector in the `users` Qdrant collection.
4. **Cold start:** If no interactions exist, embeds the user's `research_interests + bio` text instead.

---

## 13. Similar Posts Discovery

**Purpose:** Shows posts semantically similar to the one currently being viewed.

| Detail | Value |
|---|---|
| **File** | `backend/app/routers/recommendations.py` |
| **Endpoint** | `GET /api/recommendations/similar/{post_id}?limit=6` |

**How it works:**
- Retrieves the viewed post's stored vector from Qdrant (or re-embeds `title + summary` on-the-fly if the vector is missing).
- Searches for nearest neighbors filtered by the same `field`.
- Excludes the source post from results.

---

## 14. CLIP Image Embeddings

**Purpose:** Encodes images and text into a shared 512-dimensional CLIP vector space, enabling cross-modal image↔text search.

| Detail | Value |
|---|---|
| **Model** | OpenCLIP (configurable via `CLIP_MODEL_NAME` + `CLIP_PRETRAINED`) |
| **Libraries** | `open_clip`, `torch`, `PIL` |
| **File** | `backend/app/services/clip_embeddings.py` |

**How it works:**
- Thread-safe lazy-loaded singleton.
- `embed_text()` encodes text queries into the CLIP space.
- `embed_image_bytes()` encodes PNG/JPEG/WebP/GIF image bytes.
- Both return L2-normalized 512-dim vectors.
- Graceful degradation — returns `None` if the model is unavailable.

---

## 15. Image Vector Index & Search

**Purpose:** A dedicated Qdrant collection for CLIP image vectors with text→image and image→image search endpoints.

| Detail | Value |
|---|---|
| **Collection** | `images` (512-dim, cosine distance) |
| **Files** | `backend/app/services/image_index.py`, `backend/app/routers/search_images.py` |
| **Endpoints** | `GET /api/search/images?q=...` (text→image), `POST /api/search/images/by-image` (image→image) |
| **Feature flag** | `IMAGE_SEARCH_ENABLED` |

**Search modes:**
- **Text → Image:** Encodes the text query via CLIP, searches the images collection.
- **Image → Image:** Accepts a multipart image upload, CLIP-encodes it, finds visually similar images.

**Background indexing:** The `tasks.embed_image` Celery task fetches image bytes from MinIO, CLIP-embeds them, and upserts into the `images` collection (retries 2x with 15s backoff).

---

## 16. AI Writing Assistant (Draft Suggestions)

**Purpose:** Suggests a title, excerpt, and tags from draft content using a local LLM.

| Detail | Value |
|---|---|
| **LLM** | Ollama (local, model configurable via `OLLAMA_MODEL`) |
| **Backend** | `backend/app/routers/ai.py`, `backend/app/services/llm_client.py` |
| **Frontend** | `frontend/src/components/AIAssistButton.tsx` |
| **Endpoint** | `POST /api/ai/draft` (auth required) |

**How it works:**
1. The user clicks the AI assist button in the blog editor.
2. Up to 4000 characters of draft content are sent to the backend.
3. The backend sends a structured prompt to Ollama requesting exactly 3 lines: `Title:`, `Excerpt:`, `Tags:`.
4. The response is parsed (loose text format — small models are unreliable at JSON).
5. The frontend displays a modal with "Use this title" / "Use these tags" buttons for the author to accept or dismiss.

**LLM client details:**
- Thin async wrapper around Ollama's HTTP API (`/api/generate`) using `httpx`.
- Non-streaming, configurable temperature and max_tokens.
- Fully local — no external API calls to OpenAI, Anthropic, etc.

---

## 17. Post Q&A ("Ask This Post")

**Purpose:** Answers reader questions grounded exclusively in the post's content. If the article doesn't cover the question, the model says so.

| Detail | Value |
|---|---|
| **Backend** | `backend/app/routers/ai.py` |
| **Frontend** | `frontend/src/components/AskPostWidget.tsx` |
| **Endpoint** | `POST /api/ai/ask/{post_id}` (auth required) |

**How it works:**
1. Extracts the post body text (up to 4000 characters).
2. Sends the text + user question to Ollama with a grounding system prompt: "Answer ONLY from the article."
3. The response includes a `grounded: bool` field — set to `false` if the answer contains "does not cover this."
4. The frontend renders a chat-style input widget on the post detail page.

---

## 18. Contextual Ad Matching

**Purpose:** Ranks ad campaigns by relevance to the **post content** (not the user) — a privacy-first approach to ad targeting.

| Detail | Value |
|---|---|
| **File** | `backend/app/services/ad_matcher.py` |
| **Endpoint** | `GET /api/ads/serve?post_id=...` |

**Scoring formula:**

$$\text{score} = 0.35 \cdot \text{field\_match} + 0.25 \cdot \text{keyword\_overlap} + 0.10 \cdot \text{language\_match} + 0.20 \cdot \cos(\vec{v}_{\text{campaign}},\, \vec{v}_{\text{post}}) + 0.10 \cdot \text{priority}$$

- Campaign text (headline + body + keywords + fields) is embedded with MiniLM.
- Cosine similarity is computed against the post's stored embedding.
- Checks campaign eligibility (status, dates, budget) before scoring.
- No user-level tracking or targeting.

**Supporting:** Ad impression signing (`ad_signing.py`) provides HMAC-SHA256 signed tokens to prevent forged impressions, with 1-hour expiry and privacy-preserving fingerprinting.

---

## 19. AI Explanation UI

**Purpose:** Shows users **why** a post was recommended or ranked, with a visual breakdown of the AI scoring signals.

| Detail | Value |
|---|---|
| **Files** | `frontend/src/components/ExplanationChip.tsx`, `frontend/src/components/ui/AuroraChip.tsx` |
| **Trigger** | Rendered on `PostCard` when an `explanation` object is present |

**How it works:**
- Displays a headline chip based on the strongest signal (e.g., "Semantic match", "Hybrid match", "Fresh", "Popular").
- Hovering shows a tooltip breakdown with humanized percentages: "Semantic similarity: 87%, Keyword match: 65%, Freshness: 42%".
- Uses a one-shot aurora sweep animation for visual flair.

---

## 20. Prometheus ML Metrics

**Purpose:** Tracks ML task performance and infrastructure latency via Prometheus for observability.

| Detail | Value |
|---|---|
| **File** | `backend/app/services/metrics.py` |

**Metrics exported:**

| Metric | Type | Labels |
|---|---|---|
| `blogify_task_duration_seconds` | Histogram | `task` |
| `blogify_task_total` | Counter | `task`, `outcome` |
| `blogify_qdrant_query_duration_seconds` | Histogram | `operation` |
| `blogify_llm_call_duration_seconds` | Histogram | `outcome` |
| HTTP request latency + count | Histogram / Counter | path, method, status |

The `@track_task("name")` decorator wraps Celery tasks. A `PrometheusMiddleware` records per-request latency with path normalization (UUIDs → `:id`).

---

## 21. Offline Retrieval Evaluation

**Purpose:** Measures search quality against hand-authored query→slug pairs, producing standard IR metrics.

| Detail | Value |
|---|---|
| **Metrics** | Hit Rate@K, MRR@K |
| **File** | `backend/scripts/eval_retrieval.py` |
| **Trigger** | Manual CLI execution |

**How it works:**
- Runs queries through the full hybrid search pipeline (`hybrid_search_posts()`).
- Maps returned IDs back to slugs.
- Computes Hit Rate and Mean Reciprocal Rank at configurable K.
- Designed as a smoke test during model or ranker configuration changes.

---

## 22. Backfill Scripts

Scripts for bulk re-processing vectors after model upgrades or fresh infrastructure:

| Script | Purpose | File |
|---|---|---|
| **Post vector backfill** | Re-embeds all published posts with MiniLM and upserts to the `posts` Qdrant collection | `backend/scripts/backfill_post_vectors.py` |
| **Image vector backfill** | Fetches cover images from MinIO, CLIP-embeds them, upserts to the `images` collection. Uses deterministic UUID5 per URL for idempotent re-runs. | `backend/scripts/backfill_image_vectors.py` |

Both are run manually via `docker compose exec`.

---

## 23. Models & Dependencies Summary

| Model / Library | Purpose | Dimensions | Used In |
|---|---|---|---|
| `sentence-transformers/all-MiniLM-L6-v2` | Text embeddings (posts, users, tags, summaries, ads) | 384 | `embeddings.py` |
| OpenCLIP (configurable) | Image ↔ text embeddings | 512 | `clip_embeddings.py` |
| `unitary/toxic-bert` | Toxicity classification | — | `moderation.py` |
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | Search result reranking | — | `hybrid_search.py` |
| `lingua` | Language detection | — | `language.py` |
| `bm25s` + `PyStemmer` | BM25 lexical search | — | `bm25_index.py` |
| Ollama (local LLM, configurable) | Text generation (drafts, Q&A) | — | `llm_client.py` |
| Qdrant | Vector similarity search & storage | — | `vector_store.py`, `image_index.py` |

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                                  │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────┐ ┌─────────────┐  │
│  │ AIAssist   │ │ AskPost      │ │ Explanation   │ │ CoverImage  │  │
│  │ Button     │ │ Widget       │ │ Chip          │ │ Picker      │  │
│  └─────┬──────┘ └──────┬───────┘ └───────────────┘ └──────┬──────┘  │
└────────┼───────────────┼──────────────────────────────────┼──────────┘
         │               │                                  │
         ▼               ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Backend API (FastAPI)                                               │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────┐ ┌───────────────┐  │
│  │ /ai/draft│ │ /ai/ask/{id} │ │ /search/      │ │ /recommen-   │  │
│  │          │ │              │ │  semantic      │ │  dations/    │  │
│  └────┬─────┘ └──────┬───────┘ └───────┬───────┘ └───────┬───────┘  │
└───────┼──────────────┼────────────────┼───────────────────┼──────────┘
        │              │                │                   │
        ▼              ▼                ▼                   ▼
┌───────────┐  ┌───────────┐   ┌──────────────┐   ┌──────────────┐
│  Ollama   │  │  Ollama   │   │ Hybrid Search│   │   Ranker     │
│  (LLM)    │  │  (LLM)    │   │ RRF + Rerank │   │ Multi-signal │
└───────────┘  └───────────┘   └──────┬───────┘   └──────┬───────┘
                                      │                   │
                          ┌───────────┴───────────┐       │
                          ▼                       ▼       ▼
                   ┌────────────┐          ┌──────────────────┐
                   │ BM25 Index │          │   Qdrant         │
                   │ (in-memory)│          │ ┌──────────────┐ │
                   └────────────┘          │ │ posts (384d) │ │
                                           │ │ users (384d) │ │
                                           │ │ images(512d) │ │
                                           │ └──────────────┘ │
                                           └──────────────────┘
                                                    ▲
                                                    │
┌──────────────────────────────────────────────────┐│
│  Celery Workers                                  ││
│  ┌────────────────────────────────────────────┐  ││
│  │ process_post_ml                            │  ││
│  │  → text_extract → language → embed →       │──┘│
│  │    dedup → summarize → tag → moderate      │   │
│  ├────────────────────────────────────────────┤   │
│  │ update_user_vector                         │───┘
│  │  → aggregate liked/bookmarked vectors      │
│  ├────────────────────────────────────────────┤
│  │ embed_image                                │
│  │  → CLIP encode → upsert to images          │
│  └────────────────────────────────────────────┘
└──────────────────────────────────────────────────┘
```

---

*Generated April 21, 2026*
