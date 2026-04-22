# Blogify

**Where research meets the world.**

An AI-powered research blogging platform connecting researchers, students, and industry professionals — with smart recommendations, hybrid semantic search, content moderation, and an AI writing assistant, all driven by NLP, computer vision, and vector embeddings.

---

## Features

### Core Platform
- **Rich-text blog editor** — Tiptap-based editor with images, code blocks, LaTeX math, and link embeds
- **User profiles** — follow authors, view writing history, customizable bios and avatars
- **Social interactions** — like, dislike, bookmark, repost, and comment on posts
- **Real-time notifications** — in-app notification feed for follows, likes, comments, and reposts
- **My blogs dashboard** — manage all your drafts and published posts with inline delete

### AI & ML Features
- **Hybrid semantic search** — combines dense vector search (MiniLM) with BM25 lexical search via Reciprocal Rank Fusion, with optional cross-encoder reranking
- **Personalized "For You" feed** — multi-signal ranking using semantic similarity, freshness decay, engagement quality, and author diversity (MMR)
- **Similar posts discovery** — vector-based nearest-neighbor recommendations
- **AI writing assistant** — local LLM (Qwen 2.5 via Ollama) suggests titles, excerpts, and tags from your draft
- **Ask a post** — readers can ask questions answered exclusively from the post's content (grounded LLM Q&A)
- **Auto-summarization** — embedding-based extractive 3-sentence summaries
- **Auto-tagging** — KeyBERT-lite keyword extraction with Maximal Marginal Relevance for diversity
- **Content moderation** — toxicity scoring via toxic-bert with editorial soft-flagging
- **Language detection** — automatic language identification (10 languages) via lingua
- **Duplicate / plagiarism detection** — cosine similarity flagging across authors (>0.92 threshold)
- **CLIP image search** — text-to-image and image-to-image search using OpenCLIP embeddings
- **Contextual ad matching** — privacy-first, content-based ad ranking (no user tracking)
- **Explainable recommendations** — UI chips showing why each post was recommended (semantic match, freshness, etc.)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS, Tiptap Editor |
| **Backend** | FastAPI, Python 3.11+, SQLAlchemy 2 (async), Pydantic v2 |
| **Database** | PostgreSQL 16 |
| **Cache / Broker** | Redis 7 |
| **Vector DB** | Qdrant |
| **Object Storage** | MinIO |
| **Task Queue** | Celery + Redis |
| **LLM** | Ollama (Qwen 2.5 1.5B Instruct, configurable) |
| **ML Models** | MiniLM-L6-v2 (embeddings), OpenCLIP ViT-B-32 (images), toxic-bert (moderation), ms-marco cross-encoder (reranking), lingua (language) |
| **Reverse Proxy** | Nginx |
| **Containerization** | Docker Compose |

---

## Project Structure

```
Blogify/
├── backend/              # FastAPI Python backend
│   ├── app/
│   │   ├── auth/         # JWT authentication
│   │   ├── models/       # SQLAlchemy models
│   │   ├── routers/      # API endpoints
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── services/     # AI/ML services (embeddings, search, LLM, etc.)
│   │   └── tasks/        # Celery background tasks (ML pipeline)
│   ├── alembic/          # Database migrations
│   └── scripts/          # Backfill & evaluation scripts
├── frontend/             # Next.js React frontend
│   └── src/
│       ├── app/          # Pages (App Router)
│       ├── components/   # Reusable UI components
│       └── lib/          # API client, auth, types, utilities
├── nginx/                # Reverse proxy configuration
├── docs/                 # Documentation
├── docker-compose.yml    # Full-stack orchestration
└── prd.md                # Product Requirements Document
```

---

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- ~8 GB RAM recommended (ML models load in memory)

### 1. Clone & start

```bash
git clone https://github.com/<your-username>/Blogify.git
cd Blogify
docker compose up --build
```

The first run will download ML models and the Ollama LLM (~2-3 GB total). Subsequent starts are instant.

### 2. Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

### 3. (Optional) Seed demo data

```bash
docker compose exec backend python scripts/seed_demo.py
```

### 4. Access the app

| Service | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **Backend API docs** | http://localhost:8000/docs |
| **MinIO Console** | http://localhost:9001 |
| **Qdrant Dashboard** | http://localhost:6333/dashboard |

---

## Environment Variables

Create a `.env` file in the project root to override defaults. Key variables:

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET_KEY` | `change-me-in-...` | **Change this in production** |
| `OLLAMA_MODEL` | `qwen2.5:1.5b-instruct` | LLM model (e.g. `qwen2.5:7b-instruct`) |
| `HYBRID_SEARCH_ENABLED` | `true` | Enable RRF fusion of dense + BM25 |
| `RERANKER_ENABLED` | `false` | Enable cross-encoder reranking |
| `IMAGE_SEARCH_ENABLED` | `true` | Enable CLIP image search |
| `MODERATION_THRESHOLD` | `0.75` | Toxicity score threshold for flagging |

See [`backend/app/config.py`](backend/app/config.py) for all available settings.

---

## API Highlights

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login (returns JWT) |
| `GET` | `/api/posts` | List published posts (paginated) |
| `GET` | `/api/posts/mine` | List your own posts (drafts + published) |
| `GET` | `/api/posts/search/semantic` | Hybrid semantic search |
| `GET` | `/api/recommendations/for-you` | Personalized feed |
| `GET` | `/api/recommendations/similar/{id}` | Similar posts |
| `POST` | `/api/ai/draft` | AI writing suggestions |
| `POST` | `/api/ai/ask/{post_id}` | Ask a question about a post |
| `GET` | `/api/search/images` | CLIP text-to-image search |

Full interactive docs at `/docs` (Swagger UI) when the backend is running.

---

## Architecture

```
Client ──► Nginx (:80) ──┬──► Next.js Frontend (:3000)
                         └──► FastAPI Backend (:8000)
                                  │
                    ┌─────────────┼─────────────────┐
                    ▼             ▼                  ▼
               PostgreSQL    Qdrant (vectors)    MinIO (files)
                    ▲             ▲
                    │             │
               Celery Workers ───┘
                    │
               Redis (broker + cache)
                    
               Ollama (local LLM)
```

---

## License

This project is for educational and portfolio purposes.
