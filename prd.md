# BLOGIFY — Product Requirements Document (PRD)

## 1. Product Overview

**Name:** Blogify  
**Tagline:** Where research meets the world.  
**Vision:** A blog platform that connects researchers, students, and industry professionals — powered by AI-driven recommendations, NLP, and image understanding — so every reader finds the content that matters most to them.

**Problem:** Research insights are trapped in paywalled journals, scattered across personal blogs, or buried in conference proceedings. There's no single platform that combines accessible research blogging with smart, personalized discovery.

**Solution:** Blogify is an AI-powered research blogging platform where anyone can publish rich content (text, images, PDFs, code, LaTeX), and readers get hyper-relevant recommendations driven by semantic understanding of content and user behavior.

---

## 2. Target Users

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Researcher** | Academic or independent researcher | Publish findings accessibly, gain visibility, get feedback |
| **Student** | Undergrad/grad students | Discover relevant research, follow experts, learn from summaries |
| **Industry Professional** | Engineers, data scientists, etc. | Stay current on research, find applicable techniques |
| **Casual Reader** | Science-curious general audience | Browse trending research topics in digestible formats |

---

## 3. Core Features

### 3.1 Blog Publishing
- **Rich editor:** WYSIWYG + Markdown dual-mode editor
- **Content blocks:** Text, images, PDF embeds, code blocks (syntax-highlighted), LaTeX math rendering
- **Draft system:** Auto-save drafts, preview before publish
- **Versioning:** Edit history with diff view
- **Categories & fields:** Author-selected research fields (CS, Biology, Physics, etc.) + sub-fields
- **Multi-language support:** Publish in any language; auto-translation available for readers

### 3.2 Social Interactions
- **Like / Dislike** with counts
- **Threaded comments** — nested replies, Markdown support in comments
- **Repost / Share** — repost to your profile feed with optional commentary; external share links (Twitter, LinkedIn, copy link)
- **Follow researchers** — follow specific authors; get feed updates
- **Save / Bookmark** — personal collections/folders for saved posts
- **Activity feed** — chronological + algorithmic feed of followed authors and recommended content

### 3.3 Search & Discovery
- **Semantic search:** NLP-powered search that understands meaning, not just keywords
- **Filters:** By field, date range, popularity, language, content type
- **Trending:** Trending posts per field, globally, and personalized trending
- **Explore page:** Curated topics, editor picks, rising authors

### 3.4 User Profiles
- **Public profile:** Bio, affiliations, research interests, published posts, follower/following counts
- **Stats dashboard:** Views, likes, reposts, comment engagement on your posts
- **Reading history:** Private log of viewed posts (used for recommendations)

### 3.5 Notifications
- New follower, like, comment, repost
- New post from followed researcher
- Weekly digest of recommended posts (email, optional)

### 3.6 Monetization — Ads
- **Ad placements:** Sidebar ads, between-post feed ads, sponsored posts (clearly labeled)
- **Ad targeting:** Based on user interest fields (not personal data) — privacy-respecting contextual ads
- **Admin ad dashboard:** Manage ad campaigns, view impressions/clicks

---

## 4. AI/ML Pipeline

### 4.1 NLP Features

| Feature | Model / Approach | Description |
|---------|------------------|-------------|
| **Auto-tagging** | Sentence Transformers + zero-shot classification | Extract topics/tags from blog content automatically |
| **Blog summarization** | Extractive + abstractive summarization (e.g., BART/DistilBART) | Generate a TL;DR for every post |
| **Semantic search** | Sentence Transformers → Qdrant vector search | Encode queries and blog content into embeddings; retrieve by cosine similarity |
| **Multi-language translation** | MarianMT / Helsinki-NLP models (or OpenAI fallback) | On-demand translation of blog posts |
| **Content embedding** | `all-MiniLM-L6-v2` or `multi-qa-mpnet-base-dot-v1` | Generate embeddings for every blog post on publish; store in Qdrant |

### 4.2 Image Analysis

| Feature | Model / Approach | Description |
|---------|------------------|-------------|
| **Image understanding** | CLIP (OpenAI) or SigLIP | Encode images into the same embedding space as text for cross-modal recommendation matching |
| **Image-text alignment** | CLIP similarity scoring | Match image content with textual tags/topics so image-heavy posts get relevant recommendations |

### 4.3 Recommendation System

**Architecture: Hybrid Recommender**

1. **Content-based filtering (primary)**
   - Embed all blog posts (text + images) into Qdrant
   - Build a **user interest vector** = weighted average of embeddings of posts the user liked, bookmarked, read > 60%, or commented on
   - Query Qdrant for nearest neighbors to the user interest vector
   - Decay weights: recent interactions weighted more heavily (exponential decay)

2. **Collaborative filtering (secondary)**
   - User-item interaction matrix (likes, bookmarks, reads, comments)
   - Alternating Least Squares (ALS) or Neural Collaborative Filtering
   - Cold-start fallback: use content-based until sufficient interaction data

3. **Contextual signals (boosting)**
   - Recency boost (newer posts ranked higher)
   - Popularity boost (trending posts get a small lift)
   - Diversity injection (avoid filter bubbles — mix in posts from adjacent fields)
   - Author affinity (posts from followed authors weighted higher)

4. **Embedding database — Qdrant**
   - Collections: `blog_embeddings` (text), `image_embeddings` (CLIP), `user_vectors` (interest profiles)
   - Payload filters: field, language, date, author_id
   - Re-index on post update/delete

5. **Pipeline flow:**
   ```
   Publish Post → Extract text + images
       ├─→ Sentence Transformer → text embedding → Qdrant (blog_embeddings)
       ├─→ CLIP → image embedding → Qdrant (image_embeddings)
       ├─→ Summarization model → store summary in PostgreSQL
       └─→ Auto-tagger → store tags in PostgreSQL

   User browses → Log interaction → Update user interest vector (async)

   Feed request → Fetch user vector → Query Qdrant (content-based)
       ├─→ Merge with collaborative filtering scores
       ├─→ Apply contextual boosts
       └─→ Return ranked results
   ```

---

## 5. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14+ (React, App Router) | SSR/SSG for SEO, rich ecosystem, fast DX |
| **Backend API** | FastAPI (Python) | Async, fast, native Python ML ecosystem |
| **Primary DB** | PostgreSQL | Relational data — users, posts, comments, interactions |
| **Cache** | Redis | Session cache, rate limiting, feed caching, real-time counters |
| **Vector DB** | Qdrant (self-hosted) | Embeddings for recommendation + semantic search |
| **Object Storage** | MinIO (S3-compatible, self-hosted) | Images, PDFs, media files |
| **Task Queue** | Celery + Redis (broker) | Async ML tasks: embedding generation, summarization, translation |
| **NLP Models** | Sentence Transformers, BART, MarianMT | All open-source, runnable on GPU or CPU |
| **Image AI** | CLIP (via `transformers` or `open_clip`) | Image understanding for recommendations |
| **Search** | Qdrant (vector) + PostgreSQL full-text (fallback) | Hybrid semantic + keyword search |
| **Containerization** | Docker Compose | All services orchestrated locally |
| **Reverse Proxy** | Nginx | SSL termination, static file serving, load balancing |

---

## 6. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          NGINX (reverse proxy)                  │
│                     :80 / :443 (SSL)                            │
├─────────────┬───────────────────────────────────────────────────┤
│             │                                                   │
│   Next.js   │              FastAPI Backend                      │
│  Frontend   │   ┌─────────────────────────────────────┐        │
│  :3000      │   │  REST API  ─── Auth, CRUD, Feed     │        │
│             │   │  WebSocket ─── Notifications         │        │
│             │   └────────┬────────────────┬────────────┘        │
│             │            │                │                     │
│             │     ┌──────▼──────┐  ┌──────▼──────┐             │
│             │     │ PostgreSQL  │  │   Redis      │             │
│             │     │  :5432      │  │   :6379      │             │
│             │     └─────────────┘  └──────────────┘             │
│             │            │                                      │
│             │     ┌──────▼──────────────────────┐               │
│             │     │     Celery Workers           │              │
│             │     │  (ML tasks, embeddings,      │              │
│             │     │   summarization, translation)│              │
│             │     └──────┬──────────┬────────────┘              │
│             │            │          │                           │
│             │     ┌──────▼─────┐ ┌──▼───────┐                  │
│             │     │  Qdrant    │ │  MinIO    │                  │
│             │     │  :6333     │ │  :9000    │                  │
│             │     └────────────┘ └──────────┘                  │
└─────────────┴───────────────────────────────────────────────────┘
```

---

## 7. Data Models (Key Entities)

### Users
- id, email, username, password_hash, display_name, bio, avatar_url, affiliations, research_interests[], created_at, updated_at

### Posts
- id, author_id (FK→Users), title, slug, content (rich text/JSON), summary (AI-generated), tags[] (AI-generated + manual), field, sub_field, language, status (draft/published/archived), cover_image_url, pdf_url, like_count, dislike_count, repost_count, comment_count, view_count, created_at, updated_at, published_at

### Comments
- id, post_id (FK→Posts), author_id (FK→Users), parent_comment_id (nullable, for threading), content, like_count, created_at, updated_at

### Interactions
- id, user_id, post_id, type (like/dislike/bookmark/repost/view), created_at

### Follows
- follower_id (FK→Users), following_id (FK→Users), created_at

### Bookmarks
- id, user_id, post_id, folder_name (nullable), created_at

### Reposts
- id, user_id, post_id, commentary (optional text), created_at

### Notifications
- id, user_id, type, payload (JSON), read (bool), created_at

### Ad Campaigns (monetization)
- id, advertiser_name, content (image_url, text, link), target_fields[], impressions, clicks, status, start_date, end_date, created_at

---

## 8. API Design (Key Endpoints)

### Auth
- `POST /api/auth/register` — sign up
- `POST /api/auth/login` — JWT token pair
- `POST /api/auth/refresh` — refresh token
- `GET /api/auth/me` — current user profile

### Posts
- `POST /api/posts` — create/publish post (triggers async ML pipeline)
- `GET /api/posts` — list posts (paginated, filtered)
- `GET /api/posts/{slug}` — single post (logs view interaction)
- `PUT /api/posts/{id}` — update post (re-triggers embedding)
- `DELETE /api/posts/{id}` — soft delete

### Interactions
- `POST /api/posts/{id}/like` — toggle like
- `POST /api/posts/{id}/dislike` — toggle dislike
- `POST /api/posts/{id}/bookmark` — toggle bookmark
- `POST /api/posts/{id}/repost` — repost with optional commentary

### Comments
- `POST /api/posts/{id}/comments` — add comment
- `GET /api/posts/{id}/comments` — list threaded comments
- `DELETE /api/comments/{id}` — delete own comment

### Social
- `POST /api/users/{id}/follow` — toggle follow
- `GET /api/users/{id}/followers` — list followers
- `GET /api/users/{id}/following` — list following

### Feed & Recommendations
- `GET /api/feed` — personalized feed (hybrid recommender)
- `GET /api/feed/trending` — trending posts
- `GET /api/feed/explore` — explore/discover page

### Search
- `GET /api/search?q=...&field=...&lang=...` — semantic search

### Translation
- `GET /api/posts/{id}/translate?lang=fr` — on-demand translation

### Notifications
- `GET /api/notifications` — list notifications
- `WebSocket /ws/notifications` — real-time push

### Admin / Ads
- `POST /api/admin/ads` — create ad campaign
- `GET /api/admin/ads` — list campaigns
- `PUT /api/admin/ads/{id}` — update campaign
- `GET /api/admin/ads/stats` — impressions/clicks analytics

---

## 9. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Response time** | API < 200ms (p95), Feed < 500ms (p95) |
| **Availability** | 99.5% uptime (self-hosted target) |
| **Scalability** | Handle 10K concurrent users, 100K posts |
| **SEO** | SSR for all public post pages, OpenGraph meta tags |
| **Accessibility** | WCAG 2.1 AA compliance |
| **Security** | JWT auth, rate limiting, input sanitization, CORS, CSRF protection |
| **Privacy** | No personal data sold to advertisers; contextual ads only based on content fields |

---

## 10. Deployment (Docker Compose)

Services in `docker-compose.yml`:
1. `nginx` — reverse proxy + SSL
2. `frontend` — Next.js (production build)
3. `backend` — FastAPI (uvicorn)
4. `postgres` — PostgreSQL 16
5. `redis` — Redis 7
6. `qdrant` — Qdrant vector DB
7. `minio` — MinIO object storage
8. `celery-worker` — Celery workers (ML tasks)
9. `celery-beat` — Scheduled tasks (weekly digest, re-ranking)

Volumes: postgres_data, qdrant_data, minio_data, redis_data

---

## 11. Implementation Steps

### Phase A — Foundation (no dependencies)
1. **Project scaffolding** — Initialize Next.js frontend + FastAPI backend mono-repo structure, Docker Compose with all services
2. **Database schema** — Define and migrate all PostgreSQL tables (Alembic migrations)
3. **Auth system** — JWT-based registration/login/refresh with FastAPI

### Phase B — Core Platform (depends on A)
4. **Blog editor** — Rich text editor (Tiptap or Lexical) with Markdown, code blocks, LaTeX (KaTeX), image upload (→ MinIO), PDF embed
5. **Post CRUD** — Create, read, update, delete posts via API; slug-based routing
6. **Social interactions** — Like/dislike, threaded comments, repost, follow, bookmark
7. **User profiles** — Public profile pages, stats dashboard, reading history
8. **Notifications** — In-app (WebSocket) + optional email digest

### Phase C — AI/ML Pipeline (parallel with B after A)
9. **Embedding pipeline** — On post publish: Sentence Transformer → Qdrant; CLIP → Qdrant for images
10. **Auto-tagging** — Zero-shot classification on blog content → store tags
11. **Summarization** — DistilBART summarization → store TL;DR
12. **Semantic search** — Query embedding → Qdrant nearest-neighbor search + PostgreSQL fallback
13. **Translation** — On-demand MarianMT translation endpoint

### Phase D — Recommendation Engine (depends on C)
14. **Content-based recommender** — User interest vector from interactions → Qdrant ANN query
15. **Collaborative filtering** — ALS or NCF on interaction matrix
16. **Hybrid ranker** — Merge scores + contextual boosts (recency, popularity, diversity, author affinity)
17. **Feed API** — `/api/feed` serving ranked results

### Phase E — Monetization & Polish (depends on B)
18. **Ad system** — Ad campaign CRUD, placement rendering, impression/click tracking
19. **Explore & trending** — Curated explore page, trending computation (scheduled Celery task)
20. **SEO & performance** — SSR optimization, OpenGraph, sitemap, Lighthouse tuning

### Verification
- Unit tests for API endpoints (pytest)
- Integration tests for ML pipeline (embedding generation, search accuracy)
- E2E tests for critical flows: register → publish → search → find post → like → see in feed (Playwright)
- Load test feed endpoint with 10K simulated users (Locust)
- Manual verification: publish a post with images + LaTeX, confirm auto-tags and summary are accurate, confirm it appears in semantic search and feed

---

## 12. Decisions & Scope

**Included:**
- Full blog platform with social features
- AI pipeline: embeddings, auto-tagging, summarization, semantic search, translation, image understanding
- Hybrid recommendation system
- Ad-based monetization
- Self-hosted Docker Compose deployment

**Excluded (potential future scope):**
- Direct messaging between users
- Collaborative blog writing
- Mobile app (web-responsive only for now)
- Plagiarism/similarity detection
- Sentiment analysis on comments
- Verified researcher badges (ORCID integration)
- Payment processing (premium tiers)

**Key Decisions:**
- Open publishing — no verification required, lowers barrier to entry
- Contextual ads only — no personal data targeting, privacy-first
- Open-source ML stack — no vendor lock-in, all models run locally
- Qdrant over ChromaDB — better production-readiness, filtering, and scalability
