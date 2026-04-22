# Blogify — AI Overview, Testing Guide & Roadmap

_A practical map of how AI/ML is applied in Blogify today, how to exercise each feature end-to-end, and what's worth adding next._

---

## 1. Executive Summary

Blogify uses a **single local embedding model** (`sentence-transformers/all-MiniLM-L6-v2`, 384-dim) as the backbone for almost every AI feature. The model runs inside the Celery worker container, writes vectors to **Qdrant**, and powers four user-visible capabilities:

| Capability | User-visible surface |
|---|---|
| Personalized "For You" feed | `/for-you` |
| Similar-posts discovery | `/post/[slug]` (right rail / bottom section) |
| Automatic summaries & tags | every post card + detail page |
| Contextual ad targeting | `AdSlot` component |

There is **no external LLM call** (no OpenAI / Anthropic / Cohere). Everything runs offline on the CPU worker. This keeps privacy strong and ops simple, at the cost of some quality vs. large models.

---

## 2. Architecture at a Glance

```
 ┌─────────┐   publish/edit    ┌───────────────┐   send_task    ┌──────────────┐
 │ FastAPI │ ─────────────────▶│ celery broker │ ──────────────▶│ celery-worker│
 │ (API)   │                   │   (Redis)     │                │  + ST model  │
 └────┬────┘                   └───────────────┘                └──────┬───────┘
      │                                                                │
      │ read recs / similar                                            │ upsert
      ▼                                                                ▼
 ┌─────────┐   cosine search    ┌───────────┐                    ┌──────────┐
 │ clients │◀───────────────────│   Qdrant  │◀───────────────────│ vectors  │
 └─────────┘                    │ posts/users│                    └──────────┘
                                └───────────┘
```

- **Embeddings:** generated synchronously inside `tasks.process_post_ml` and `tasks.update_user_vector`.
- **Qdrant** holds two collections: `posts` and `users`, both 384-dim cosine.
- **Recommendations** are served directly from FastAPI by querying Qdrant (no Celery hop).
- **Fallback path:** if Qdrant is empty or unreachable, endpoints return trending (engagement-ranked) posts instead of erroring.

---

## 3. Feature Inventory

### 3.1 Text Embeddings Service
- **File:** [backend/app/services/embeddings.py](../backend/app/services/embeddings.py)
- **Model:** `sentence-transformers/all-MiniLM-L6-v2` (384-dim, ~22 MB, CPU-friendly)
- **Pattern:** lazy-loaded thread-safe singleton — first call pays the model-load cost, later calls are hot.
- **Used by:** post embedding, user profile embedding, auto-tagging, summarization, ad matching.

### 3.2 Vector Store (Qdrant)
- **File:** [backend/app/services/vector_store.py](../backend/app/services/vector_store.py)
- **Collections:**
  - `posts` — one vector per published post + payload (`author_id`, `field`, `language`, `tags`, `auto_tags`, `published_at`, `title`, `slug`).
  - `users` — one vector per user representing their interest profile.
- **Distance:** cosine.
- **Docker:** `qdrant/qdrant:latest` on ports `6333/6334`, volume `qdrant_data`.

### 3.3 Async ML Task Pipeline (Celery)
- **File:** [backend/app/tasks/ml_tasks.py](../backend/app/tasks/ml_tasks.py)
- **Broker:** Redis (`db=1` broker, `db=2` backend).
- **Tasks:**
  - `tasks.process_post_ml` — runs on publish/edit. Extracts text from the Tiptap JSON, embeds it, upserts to Qdrant, and computes summary + auto-tags.
  - `tasks.update_user_vector` — runs on like/bookmark or manual reindex. Averages the user's last 50 liked + 50 bookmarked post vectors; cold-starts from `research_interests + bio` if no interactions exist.
- **Retry policy:** 3 retries with 30 s backoff; idempotent upserts.

### 3.4 Personalized "For You" Feed
- **Files:** [backend/app/routers/recommendations.py](../backend/app/routers/recommendations.py), [frontend/src/app/for-you/page.tsx](../frontend/src/app/for-you/page.tsx)
- **Endpoint:** `GET /api/recommendations/for-you?limit=20&field=&language=`
- **Pipeline:** user vector → ANN search in `posts` → exclude own posts and already-interacted posts → optional field/language filter.
- **Cold start:** if no user vector, returns trending.

### 3.5 Similar Posts
- **Files:** [backend/app/routers/recommendations.py](../backend/app/routers/recommendations.py), [frontend/src/components/SimilarPosts.tsx](../frontend/src/components/SimilarPosts.tsx)
- **Endpoint:** `GET /api/recommendations/similar/{post_id}?limit=6`
- **Behavior:** fetches the post's vector (or re-embeds on the fly if missing), searches neighbors, removes the post itself.

### 3.6 Auto-Tagging (MMR Keyword Extraction)
- **File:** [backend/app/services/tagger.py](../backend/app/services/tagger.py)
- **Algorithm:** generate 1–3-gram candidates → embed → rank by similarity to document centroid → select 6 with **Maximal Marginal Relevance** (diversity weight 0.6).
- **Output:** stored on `Post.auto_tags`, shown on cards/detail pages, and used by the ad matcher for keyword overlap.

### 3.7 Extractive Summarization
- **File:** [backend/app/services/summarizer.py](../backend/app/services/summarizer.py)
- **Algorithm:** sentence split → embed each sentence → compute document centroid → pick top-3 sentences by cosine to centroid, preserving original order. Capped at ~400 chars.
- **Output:** stored on `Post.summary` if the user did not provide one.

### 3.8 Reading Time
- **File:** [backend/app/models/post.py](../backend/app/models/post.py) (`reading_time_minutes` property)
- **Heuristic only:** `max(1, round(word_count / 200))` — not AI, listed for completeness.

### 3.9 Contextual Ad Matcher (Privacy-First)
- **Files:** [backend/app/services/ad_matcher.py](../backend/app/services/ad_matcher.py), [backend/app/routers/ads.py](../backend/app/routers/ads.py), [frontend/src/components/AdSlot.tsx](../frontend/src/components/AdSlot.tsx)
- **Signal:** **the post**, not the user. Score = `0.35·field + 0.25·keyword_overlap + 0.10·language + 0.20·cosine(campaign, post) + 0.10·priority_boost`.
- **Endpoints:** `GET /api/ads/serve`, `POST /api/ads/impression`, `GET /api/ads/click`.
- **Impression tokens:** short-lived HMAC-SHA256 JWT; viewer fingerprint is `sha256(ip + user-agent)`.

### 3.10 Trending (heuristic, not AI)
- `GET /api/posts/trending?window_days=…` ranks by `likes + 2·reposts + comments + 0.1·views`.
- Used as the fallback for the For You feed and on the trending page.

---

## 4. What Is _Not_ Implemented

| Feature | Status | Notes |
|---|---|---|
| Semantic search endpoint | ❌ | `/api/posts?search=` is SQL `ILIKE` only. |
| Image embeddings (CLIP) | ❌ | `open-clip-torch` is in `requirements.txt` but unused. |
| Toxicity / content moderation | ❌ | No classifier wired in. |
| Plagiarism / duplicate detection | ❌ | Could reuse post embeddings cheaply. |
| Spam / low-effort detection | ❌ | — |
| Translation / cross-language recs | ❌ | Language is filtered, never translated. |
| Collaborative filtering (ALS / neural CF) | ❌ | Recs are 100% content-based. |
| LLM features (summary polishing, Q&A over post, writing assistant) | ❌ | No external model wired. |

---

## 5. How to Actually Test It End-to-End

All commands assume the stack is up (`docker compose up -d --build`).

### 5.1 Sanity checks — infra
```powershell
# Qdrant is alive and has the two collections
curl http://localhost:6333/collections

# Celery worker is connected
docker compose logs celery-worker --tail 50

# Redis broker/backend DBs respond
docker compose exec redis redis-cli PING
```

Expected: `collections: [posts, users]`, worker log shows `ready.`, Redis replies `PONG`.

### 5.2 Post pipeline — embeddings, summary, auto-tags
1. Log in as the seed admin (`admin@blogify.com` / `admin123`).
2. Publish a post of ≥ 300 words (e.g. paste a short Wikipedia article).
3. Watch the worker:
   ```powershell
   docker compose logs celery-worker -f
   ```
   You should see `tasks.process_post_ml[...] succeeded`.
4. Verify the vector landed:
   ```powershell
   curl http://localhost:6333/collections/posts/points/count
   ```
5. Reload the post page — `summary` and `auto_tags` should now be populated, and the **Similar reads** section on other posts of the same field should include it.

**Red flags:** `auto_tags` empty after 30 s → worker not running; summary stays blank → the post's text extraction returned < 4-word sentences (very short post); 500 on publish → Qdrant unreachable.

### 5.3 "For You" personalization
1. As a fresh user (sign up via `/auth/register`), open `/for-you` — you should see **trending fallback** (no personalized badge logic triggered).
2. Like or bookmark 3–5 posts in one field (e.g. Biology).
3. Either wait a few seconds for `tasks.update_user_vector` to finish, or click **Reindex** on `/for-you`.
4. Refresh `/for-you` — the top results should now skew toward Biology.
5. Verify the user vector exists:
   ```powershell
   curl http://localhost:6333/collections/users/points/count
   ```

### 5.4 Similar posts
1. Open any published post's detail page.
2. Scroll to **Similar reads**.
3. Ensure the current post is **not** in the list and that listed posts share field/topic.
4. Edge case: for a brand-new post with only 1 total post in the DB, the list should be empty (graceful), not 500.

### 5.5 Field filter (regression-prone)
1. From `/explore`, click a field card — you should land on `/feed?field=Medicine`.
2. The heading should read "Medicine" and a **Clear filter** pill should be visible.
3. `/trending` field chips should also filter correctly (they use full capitalized DB values like `"Computer Science"`, not slugs).

### 5.6 Ad matcher
1. Seed or create an ad campaign with `target_fields=["Biology"]`, budget > 0, dates covering today.
2. Open a Biology post — `AdSlot` should render that campaign.
3. Network tab: `GET /api/ads/serve?post_id=…` returns an `impression_token`; an auto-fired `POST /api/ads/impression` returns 204.
4. Click the ad — should 302 to the campaign link and increment `campaign.clicks`.

### 5.7 Automated API smoke test (optional)
Quick curl probe to confirm the three AI endpoints answer 200 after login:
```powershell
$token = (curl -s -X POST http://localhost:8000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"admin@blogify.com\",\"password\":\"admin123\"}' | ConvertFrom-Json).access_token

curl -H "Authorization: Bearer $token" http://localhost:8000/api/recommendations/for-you
curl -H "Authorization: Bearer $token" http://localhost:8000/api/posts/trending
curl -H "Authorization: Bearer $token" http://localhost:8000/api/recommendations/similar/<POST_ID>
```

### 5.8 Common failure modes
| Symptom | Likely cause | Fix |
|---|---|---|
| `/for-you` always shows same posts | User vector never built | Like/bookmark 3+ posts or hit `POST /api/recommendations/reindex/me` |
| Summary/tags blank forever | Celery not running or crashed on load | `docker compose logs celery-worker`; first load downloads model (~22 MB) |
| Similar posts empty | `posts` collection has 0 or 1 vectors | Publish more posts, re-trigger ML task |
| 500 on publish | Qdrant unreachable from worker | Check `QDRANT_HOST=qdrant` env var; restart stack |

---

## 6. What's Worth Adding Next

Ordered by **impact per effort** for a research-blog product.

### 6.1 High ROI, low effort
1. **Semantic search endpoint** — `GET /api/search/semantic?q=…` that embeds the query and searches the `posts` collection. All infra already exists; it's essentially 30 lines. Replace or augment the current SQL `ILIKE` search page.
2. **Duplicate / near-duplicate guard on publish** — before upserting, check top-1 cosine in `posts`; warn the author if > 0.92 to any existing post.
3. **"More from this author" rail** — Qdrant filter by `author_id` + similarity to the current post. One query.
4. **Language detection** — run `lingua-py` or `fasttext-langdetect` on publish, set `Post.language` automatically instead of trusting the form field.

### 6.2 High ROI, medium effort
5. **Hybrid search (BM25 + vectors)** — Qdrant has native sparse-vector support; combining SPLADE / BM25 with the dense model typically adds 10–20 % recall on keyword-heavy queries.
6. **Reranking** — keep ANN top-50 from Qdrant, rerank top-10 with a cross-encoder (`cross-encoder/ms-marco-MiniLM-L-6-v2`). Huge precision win on both search and similar-posts.
7. **Toxicity / moderation** — `unitary/toxic-bert` or `Detoxify` on publish; block or queue for review above a threshold. Critical before opening sign-ups.
8. **Smart excerpt / title suggestions** — embed the draft, retrieve k nearest titles as style cues, generate with a small local LLM (Phi-3-mini, Qwen2.5-1.5B) — still no external API needed.

### 6.3 Higher effort, strategic
9. **Multi-signal "For You"** — combine content vector (current) with collaborative signal from co-like graph. Even a simple logistic blend on `[cosine, coauthor_overlap, field_match, recency]` beats pure content-based.
10. **CLIP image-text match** — the dependency is already installed. Use it for (a) image-aware similar posts, (b) auto-generated alt text, (c) cover-image suggestions from post content.
11. **On-post Q&A** — retrieval-augmented generation over the post body using a local LLM; "ask this paper" on the detail page.
12. **Explainability** — return the top matching phrase or keyword for each similar/recommended post so users see _why_ it was shown. Builds trust far more than the recs themselves.

### 6.4 Ops & quality
13. **Offline eval harness** — snapshot `posts` + interactions nightly, replay and measure recall@10 / nDCG for recommendations. Without this, any change is a guess.
14. **Backfill job** — for embeddings/summaries/tags when the model or algorithm changes (`celery beat` weekly, or on-demand admin endpoint).
15. **Model upgrade path** — `all-MiniLM-L6-v2` is fast but dated. `bge-small-en-v1.5` or `gte-small` gives a meaningful quality bump at the same latency. Plan for a versioned collection so reindexing is a collection swap, not a migration.
16. **Observability** — emit a Prometheus counter per ML task (success/fail/duration), and a histogram of Qdrant query latency. Today it's all inferred from logs.

---

## 7. TL;DR

- Blogify's AI is **one model doing a lot** (all-MiniLM-L6-v2 → Qdrant) plus a heuristic ad scorer.
- It already powers four user-facing features (For You, Similar, Auto-Summary/Tags, Contextual Ads), with clean async fallbacks.
- The fastest next wins are **semantic search, duplicate guard, reranker, and language detection** — all reusing the stack that exists.
- The strategic next wins are **hybrid search, moderation, and an offline eval harness** before scaling users.
