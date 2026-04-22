"""Seed demo data: users, blog posts with cover + inline images, interactions.

Run inside the backend container:

    docker compose exec -e PYTHONPATH=/app backend python scripts/seed_demo.py

Idempotent — every seeded row carries the "demo-seed" tag / email suffix so
re-running wipes the previous demo set cleanly before re-inserting.

Images are fetched from picsum.photos (deterministic by seed slug), uploaded
to MinIO via the normal storage pipeline, and passed through both the MiniLM
post-embedding task AND the CLIP image-embedding task so all retrieval paths
(hybrid text search, for-you, similar, image-by-text, image-by-image) get
real data to reason about.
"""
from __future__ import annotations

import logging
import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import delete, select

from app.auth.utils import hash_password
from app.database import sync_session
from app.models.comment import Comment  # noqa: F401 — register mapper
from app.models.interaction import Bookmark, Follow, Interaction, InteractionType
from app.models.post import Post, PostStatus
from app.models.user import User

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("seed")

DEMO_TAG = "demo-seed"
DEMO_EMAIL_SUFFIX = "@demo.blogify.local"
DEMO_PASSWORD = "DemoPass1234!"
PICSUM_BASE = "https://picsum.photos/seed"


# ---------------------------------------------------------------------------
# Content fixtures
# ---------------------------------------------------------------------------

USERS: list[dict[str, Any]] = [
    {
        "username": "aria_nlp",
        "display_name": "Dr. Aria Chen",
        "bio": "NLP researcher focused on retrieval-augmented generation and long-context transformers.",
        "affiliations": "Stanford AI Lab",
        "research_interests": ["NLP", "transformers", "RAG", "language models"],
    },
    {
        "username": "marcus_bio",
        "display_name": "Prof. Marcus Okafor",
        "bio": "Computational biologist studying protein folding and CRISPR off-target effects.",
        "affiliations": "Broad Institute",
        "research_interests": ["genomics", "protein folding", "CRISPR", "bioinformatics"],
    },
    {
        "username": "luna_quantum",
        "display_name": "Luna Ivanova",
        "bio": "Quantum computing PhD candidate — error correction and variational circuits.",
        "affiliations": "ETH Zürich",
        "research_interests": ["quantum computing", "error correction", "variational circuits"],
    },
    {
        "username": "kai_robotics",
        "display_name": "Kai Tanaka",
        "bio": "Robotics engineer building foundation models for manipulation and locomotion.",
        "affiliations": "DeepMind",
        "research_interests": ["robotics", "reinforcement learning", "manipulation", "embodied AI"],
    },
    {
        "username": "sofia_med",
        "display_name": "Dr. Sofia Moreno",
        "bio": "Clinical researcher exploring AI-assisted radiology and multimodal medical imaging.",
        "affiliations": "Mayo Clinic",
        "research_interests": ["medical imaging", "radiology", "multimodal AI", "diagnostics"],
    },
    {
        "username": "ethan_econ",
        "display_name": "Ethan Park",
        "bio": "Behavioural economist modelling market dynamics with agent-based simulations.",
        "affiliations": "LSE",
        "research_interests": ["behavioural economics", "agent-based modeling", "market dynamics"],
    },
    {
        "username": "nova_astro",
        "display_name": "Dr. Nova Rahman",
        "bio": "Astrophysicist hunting exoplanets with the JWST and analysing transit spectra.",
        "affiliations": "MIT Kavli Institute",
        "research_interests": ["exoplanets", "JWST", "astrophysics", "spectroscopy"],
    },
    {
        "username": "jun_systems",
        "display_name": "Jun Li",
        "bio": "Systems engineer — distributed databases, consensus protocols, and low-latency storage.",
        "affiliations": "CMU",
        "research_interests": ["distributed systems", "consensus", "databases", "Raft"],
    },
]


POSTS: list[dict[str, Any]] = [
    {
        "author_username": "aria_nlp",
        "title": "Why Retrieval-Augmented Generation Beats Bigger Context Windows",
        "field": "AI",
        "sub_field": "Natural Language Processing",
        "language": "en",
        "tags": ["NLP", "RAG", "transformers", "LLM"],
        "image_seed": "rag-transformers",
        "inline_seeds": ["retrieval-diagram", "attention-heatmap"],
        "paragraphs": [
            "Everyone loves the headline number: a million-token context window, a ten-million-token context window, an unbounded context window. But in production the longer-context model almost always loses to a careful retrieval pipeline feeding a smaller one.",
            "The reason is simple: attention cost scales with sequence length, and signal density decays fast. Dropping ten thousand tokens of chat history into your prompt teaches the model that most of its context is noise — exactly the wrong inductive bias.",
            "A well-tuned RAG pipeline inverts this. You pay the quadratic cost only on a hundred tokens of curated, high-density context, and you spend your retrieval budget on a hybrid BM25 + dense index that actually understands what the user is asking.",
            "In our benchmark across 1,200 research-blog queries, hybrid retrieval with reciprocal rank fusion and a cross-encoder reranker beat a 128k-context single-shot baseline on faithfulness by 14 points and latency by 3x.",
        ],
        "code": "def rrf_fuse(dense, bm25, k=60):\n    scores = {}\n    for rank, (pid, _s) in enumerate(dense):\n        scores[pid] = scores.get(pid, 0) + 1 / (k + rank)\n    for rank, (pid, _s) in enumerate(bm25):\n        scores[pid] = scores.get(pid, 0) + 1 / (k + rank)\n    return sorted(scores.items(), key=lambda x: -x[1])",
        "quote": "Retrieval is not a workaround for small context. It's a better inductive bias.",
    },
    {
        "author_username": "aria_nlp",
        "title": "The Silent Cost of Instruction Tuning: Calibration Collapse",
        "field": "AI",
        "sub_field": "Language Models",
        "language": "en",
        "tags": ["instruction tuning", "RLHF", "calibration", "LLM"],
        "image_seed": "calibration-curve",
        "inline_seeds": ["loss-landscape"],
        "paragraphs": [
            "Instruction-tuned models are confident. Too confident. When we measured the expected calibration error on MMLU across a family of 7B–70B base vs instruct variants, every single instruct model was worse-calibrated than its base counterpart.",
            "This isn't news to practitioners who have watched an RLHF'd model hallucinate with a straight face. But the magnitude surprised us: a 3–5x ECE gap, consistent across model scale.",
            "Post-hoc temperature scaling helps, but only partially — the problem is structural. Human preference data rewards decisiveness; the model learns to compress its output distribution toward a confident mode.",
        ],
        "quote": "A well-calibrated model that sometimes says 'I don't know' is worth more than a confident model that doesn't.",
    },
    {
        "author_username": "marcus_bio",
        "title": "AlphaFold Was the Start, Not the Finish: What Protein Dynamics Still Hides",
        "field": "Biology",
        "sub_field": "Structural Biology",
        "language": "en",
        "tags": ["protein folding", "AlphaFold", "molecular dynamics"],
        "image_seed": "protein-helix",
        "inline_seeds": ["ribosome", "molecular-dynamics"],
        "paragraphs": [
            "AlphaFold gave us 200 million high-quality static structures. That is genuinely civilisation-altering. But biology is not static, and a single frame of a dance tells you almost nothing about the choreography.",
            "The hard problems — allostery, cryptic pockets, intrinsically disordered regions, conformational switching — all require dynamics, and dynamics require either expensive simulation or clever inference from sparse experimental data.",
            "The next breakthrough will come from models that don't predict a structure but a conformational ensemble with correct Boltzmann weights. Early work from Chroma and ESMFlow is promising; the field still needs a shared benchmark.",
        ],
    },
    {
        "author_username": "marcus_bio",
        "title": "CRISPR Off-Target Effects: Why In-Silico Prediction Still Fails",
        "field": "Biology",
        "sub_field": "Genomics",
        "language": "en",
        "tags": ["CRISPR", "off-target", "genomics", "machine learning"],
        "image_seed": "dna-helix",
        "inline_seeds": ["gene-editing"],
        "paragraphs": [
            "Every CRISPR trial sponsor will tell you they predict off-targets in silico before they go to the bench. What they won't tell you is how often the bench disagrees.",
            "In a review of 47 published studies, the false-negative rate of the top in-silico predictors averaged 22%. That means one in five true off-target sites goes undetected until wet validation.",
            "The root cause is training data: we have dramatically more on-target examples than off-target ones, and the distribution of real off-targets is long-tailed. No amount of model scale fixes that.",
        ],
    },
    {
        "author_username": "luna_quantum",
        "title": "Surface Codes Are Beautiful. They're Also Expensive.",
        "field": "Physics",
        "sub_field": "Quantum Computing",
        "language": "en",
        "tags": ["quantum computing", "error correction", "surface code"],
        "image_seed": "quantum-lattice",
        "inline_seeds": ["qubit-array", "bloch-sphere"],
        "paragraphs": [
            "The surface code has become the default assumption for fault-tolerant quantum computing, and for good reason: it has a high threshold, requires only nearest-neighbour gates, and has decades of theoretical backing.",
            "But the overhead is brutal. A logical qubit below 10^-15 error rate, assuming physical error rates near threshold, needs around a thousand physical qubits. Scale to a useful algorithm and you're looking at tens of millions.",
            "This is why I believe LDPC codes and qLDPC families deserve a serious second look. Recent IBM work on bivariate bicycle codes suggests we might cut overhead by an order of magnitude — at the price of longer-range connectivity.",
        ],
        "code": "# Surface-code logical X failure rate vs physical error p\nimport numpy as np\ndef logical_error(p, d, p_th=0.01):\n    return 0.03 * (p / p_th) ** ((d + 1) / 2)",
    },
    {
        "author_username": "kai_robotics",
        "title": "Why Foundation Models for Robotics Haven't Had Their GPT Moment",
        "field": "AI",
        "sub_field": "Robotics",
        "language": "en",
        "tags": ["robotics", "foundation models", "manipulation", "embodied AI"],
        "image_seed": "robot-arm",
        "inline_seeds": ["manipulation-gripper", "warehouse-robot"],
        "paragraphs": [
            "Language models scaled because the internet handed us a trillion tokens of structured-enough text. Robotics has no such gift. Every useful demonstration requires a physical body, a physical world, and a human to label what went well.",
            "The Open X-Embodiment dataset is a great start — about a million trajectories — but that is roughly three orders of magnitude below what vision got from ImageNet. And robotics data doesn't compose the way text does.",
            "The interesting bet right now is synthetic data from high-fidelity simulators combined with a small wedge of real-world fine-tuning. Isaac Sim and MuJoCo MPC are closing the sim-to-real gap for manipulation, though locomotion is still where the real progress lives.",
        ],
    },
    {
        "author_username": "kai_robotics",
        "title": "Reinforcement Learning Is Finally Eating Classical Control — Slowly",
        "field": "AI",
        "sub_field": "Reinforcement Learning",
        "language": "en",
        "tags": ["reinforcement learning", "control", "robotics"],
        "image_seed": "quadruped",
        "inline_seeds": ["reward-curve"],
        "paragraphs": [
            "For two decades, 'just use a PID' was the correct answer in robotics almost all the time. Model-free RL was too sample-hungry and too brittle.",
            "That has quietly changed. Parallel GPU simulation gives us millions of environment steps per second, and PPO with well-designed reward shaping now matches or beats hand-tuned controllers on quadrupeds, humanoids, and dextrous hands.",
            "What's missing is a theory of why some reward functions generalise out-of-distribution and others catastrophically don't. Until we have that, every new task still takes a month of a grad student's life.",
        ],
    },
    {
        "author_username": "sofia_med",
        "title": "Multimodal Models Are About to Change Radiology — Not Replace It",
        "field": "Medicine",
        "sub_field": "Radiology",
        "language": "en",
        "tags": ["medical imaging", "multimodal AI", "radiology"],
        "image_seed": "mri-brain",
        "inline_seeds": ["xray-chest", "ct-scan"],
        "paragraphs": [
            "Every year someone writes a piece predicting the end of radiology. Every year the number of open radiology posts grows. Both things remain true.",
            "What is actually changing is the shape of the job. Multimodal models that ingest the image, the prior report, the EHR note, and the referring physician's free-text question can surface a candidate differential in seconds.",
            "The radiologist's role shifts from reader to adjudicator. That is a good thing for patient outcomes — more attention on the hard cases — and it's a genuinely different skill to train for.",
        ],
        "quote": "The question is no longer 'can the model read the scan'. It is 'can the clinician read the model'.",
    },
    {
        "author_username": "sofia_med",
        "title": "The Hidden Distribution Shift in Hospital AI Deployments",
        "field": "Medicine",
        "sub_field": "Clinical Informatics",
        "language": "en",
        "tags": ["clinical AI", "distribution shift", "deployment"],
        "image_seed": "hospital-ward",
        "inline_seeds": ["patient-monitor"],
        "paragraphs": [
            "A sepsis model trained on a five-year retrospective cohort will, at some point, be deployed on patients who are in a different hospital, on a different protocol, with different demographics, in a different season.",
            "Every one of those axes is a distribution shift, and every one silently degrades performance in a way nobody catches until a clinician raises a complaint six months in.",
            "Continuous monitoring — sensitivity to subgroup performance, label drift, covariate drift — should be a day-one requirement of any clinical ML deployment. It almost never is.",
        ],
    },
    {
        "author_username": "ethan_econ",
        "title": "Agent-Based Models Are Back, and This Time They Might Actually Work",
        "field": "Economics",
        "sub_field": "Behavioural Economics",
        "language": "en",
        "tags": ["agent-based modeling", "behavioural economics", "simulation"],
        "image_seed": "market-graph",
        "inline_seeds": ["trading-floor"],
        "paragraphs": [
            "Agent-based models had their first hype wave in the 2000s and mostly disappointed. The critique was fair: parameter explosion, no identification strategy, and almost no validation against real-world data.",
            "What's changed is that we can now calibrate an ABM against millions of individual trajectories — from credit card data, from order-book data, from mobility data — using simulation-based inference.",
            "Early results in systemic risk modelling are encouraging. We correctly reproduced the March 2023 regional bank stress in a model calibrated only on Q4 2022 data. That is a real out-of-sample win.",
        ],
    },
    {
        "author_username": "nova_astro",
        "title": "JWST Is Finding Exoplanet Atmospheres We Didn't Expect",
        "field": "Physics",
        "sub_field": "Astrophysics",
        "language": "en",
        "tags": ["exoplanets", "JWST", "spectroscopy", "atmospheres"],
        "image_seed": "exoplanet",
        "inline_seeds": ["jwst-telescope", "transit-spectrum"],
        "paragraphs": [
            "Our pre-JWST priors said most small-planet atmospheres would be cloud-dominated, hydrogen-rich, and boring. Several of the first TRAPPIST-1 observations have broken all three assumptions.",
            "The most striking is the near-total absence of a thick atmosphere on TRAPPIST-1b. This is consistent with atmospheric loss via stellar wind, and it has uncomfortable implications for the habitability of other M-dwarf systems.",
            "We need more observations, and we need them now. Every cycle of JWST time is precious, and atmospheric characterisation on sub-Neptunes is a genuine frontier.",
        ],
    },
    {
        "author_username": "nova_astro",
        "title": "Why Transit Spectroscopy Is Harder Than the Papers Make It Look",
        "field": "Physics",
        "sub_field": "Astrophysics",
        "language": "en",
        "tags": ["exoplanets", "spectroscopy", "data analysis"],
        "image_seed": "starfield",
        "inline_seeds": ["spectrum-plot"],
        "paragraphs": [
            "The headline plot of a transit spectrum looks clean. The analysis that produces it is anything but.",
            "You are measuring a 100 parts-per-million signal on top of stellar activity that varies by more than that on timescales ranging from minutes to years. Every choice — detrending, limb-darkening model, instrumental systematics — moves the answer by at least the size of the feature you're trying to detect.",
            "Blind analysis — where multiple teams reduce the same data and only compare at the end — should be standard practice. It almost isn't, and that is how we end up with retractions.",
        ],
    },
    {
        "author_username": "jun_systems",
        "title": "Raft Is Simpler Than Paxos. That's Not the Same as Simple.",
        "field": "Computer Science",
        "sub_field": "Distributed Systems",
        "language": "en",
        "tags": ["distributed systems", "consensus", "Raft", "Paxos"],
        "image_seed": "server-rack",
        "inline_seeds": ["network-topology"],
        "paragraphs": [
            "Diego Ongaro's stated design goal for Raft was understandability, and he succeeded. Undergraduate distributed systems courses teach it; Paxos usually shows up as an advanced topic or a footnote.",
            "But the gap between understanding a paper and correctly implementing consensus in production is vast. TiKV, etcd, and Consul have all shipped subtle Raft bugs that took months to diagnose.",
            "The failure modes are almost always the ones not covered on page 3: snapshot installation during leadership change, non-voting learners, split-brain under partial partitions. The fact that the safety proof holds does not mean the implementation does.",
        ],
        "code": "// Simplified Raft append-entries handler\nfunc (r *Raft) AppendEntries(args AEArgs) AEReply {\n    if args.Term < r.currentTerm { return AEReply{Success: false} }\n    r.leader = args.LeaderID\n    r.resetElectionTimer()\n    return AEReply{Term: r.currentTerm, Success: true}\n}",
    },
    {
        "author_username": "jun_systems",
        "title": "The Case Against Microservices for Teams Under 50 People",
        "field": "Computer Science",
        "sub_field": "Software Architecture",
        "language": "en",
        "tags": ["microservices", "monolith", "architecture"],
        "image_seed": "service-mesh",
        "inline_seeds": ["architecture-diagram"],
        "paragraphs": [
            "Microservices are an organisational solution dressed as a technical one. The whole point is independent deployment by independent teams — Conway's law made literal.",
            "If you do not have independent teams, you do not have the problem microservices solve. You just have a monolith with extra RPC overhead, distributed tracing you haven't yet set up, and a network that is going to fail in production in ways your local dev setup never showed you.",
            "Start with a well-structured monolith. Split only when you have more than one team trying to ship on the same repository and they are blocking each other. This is almost always the right call.",
        ],
    },
    {
        "author_username": "luna_quantum",
        "title": "Variational Quantum Algorithms Have a Barren Plateau Problem",
        "field": "Physics",
        "sub_field": "Quantum Computing",
        "language": "en",
        "tags": ["quantum computing", "VQE", "QAOA", "optimization"],
        "image_seed": "wave-function",
        "inline_seeds": ["optimization-landscape"],
        "paragraphs": [
            "Variational quantum algorithms promised a near-term path to quantum advantage: use the quantum computer to evaluate a parametrised circuit, use a classical optimiser to update parameters, and iterate.",
            "The barren plateau result — McClean et al. 2018 and its many follow-ups — showed that for generic random circuits, gradients decay exponentially in the number of qubits. Optimisation becomes a random walk on a flat surface.",
            "Structured ansätze, problem-informed initialisations, and symmetry-preserving circuits all help. None of them make the problem fully go away. The honest position today is that VQAs work on small instances and we do not yet know if they scale.",
        ],
    },
    {
        "author_username": "ethan_econ",
        "title": "Why Behavioural Nudges Don't Replicate",
        "field": "Economics",
        "sub_field": "Behavioural Economics",
        "language": "en",
        "tags": ["behavioural economics", "replication", "nudges"],
        "image_seed": "decision-tree",
        "inline_seeds": ["survey-data"],
        "paragraphs": [
            "The nudge revolution gave us a lot of 2-page Science papers with beautiful effect sizes. The replication crisis gave us a lot of 20-page follow-ups with effect sizes a third as large, or zero, or the wrong direction.",
            "This is not a scandal. It is how science is supposed to work. The scandal is the policy apparatus that deployed interventions based on a single underpowered study with a 40% effect size, pretending that number was the truth.",
            "Pre-registration, multi-site replications, and adversarial collaborations are slowly becoming the norm. They should have been the norm 20 years ago.",
        ],
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def fetch_image(seed: str, width: int = 1200, height: int = 600) -> bytes | None:
    """Fetch a deterministic picsum image by seed slug. Returns bytes or None."""
    url = f"{PICSUM_BASE}/{seed}/{width}/{height}"
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            r = client.get(url)
            if r.status_code == 200 and len(r.content) > 1024:
                return r.content
            log.warning("picsum %s -> HTTP %d", url, r.status_code)
    except Exception as exc:  # noqa: BLE001
        log.warning("picsum fetch failed for %s: %s", seed, exc)
    return None


def upload_image(seed: str, size: tuple[int, int] = (1200, 600)) -> str | None:
    """Fetch seed image and upload to MinIO. Returns /media/<key> URL or None."""
    from app.services.storage import upload_file

    data = fetch_image(seed, size[0], size[1])
    if not data:
        return None
    return upload_file(data, f"{seed}.jpg", "image/jpeg")


def build_tiptap_content(
    paragraphs: list[str],
    inline_image_urls: list[str],
    code: str | None = None,
    quote: str | None = None,
) -> dict[str, Any]:
    """Construct a Tiptap JSON document interleaving paragraphs with images."""
    nodes: list[dict[str, Any]] = []

    for i, para in enumerate(paragraphs):
        nodes.append(
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": para}],
            }
        )
        # After the 1st and 3rd paragraph, splice an inline image if available.
        if inline_image_urls and i in (0, 2):
            idx = 0 if i == 0 else 1
            if idx < len(inline_image_urls):
                nodes.append(
                    {
                        "type": "image",
                        "attrs": {"src": inline_image_urls[idx], "alt": None, "title": None},
                    }
                )

    if quote:
        nodes.append(
            {
                "type": "blockquote",
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": quote}]}],
            }
        )

    if code:
        nodes.append(
            {
                "type": "codeBlock",
                "attrs": {"language": "python"},
                "content": [{"type": "text", "text": code}],
            }
        )

    return {"type": "doc", "content": nodes}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def wipe_previous_demo_data(db) -> None:
    """Delete previously seeded demo users + posts. Idempotency guarantee."""
    # Posts tagged "demo-seed"
    demo_post_ids = db.execute(
        select(Post.id).where(Post.tags.any(DEMO_TAG))
    ).scalars().all()
    demo_user_ids = db.execute(
        select(User.id).where(User.email.like(f"%{DEMO_EMAIL_SUFFIX}"))
    ).scalars().all()

    if demo_post_ids:
        log.info("Wiping %d previously-seeded posts…", len(demo_post_ids))
        db.execute(delete(Interaction).where(Interaction.post_id.in_(demo_post_ids)))
        db.execute(delete(Bookmark).where(Bookmark.post_id.in_(demo_post_ids)))
        db.execute(delete(Comment).where(Comment.post_id.in_(demo_post_ids)))
        db.execute(delete(Post).where(Post.id.in_(demo_post_ids)))

    if demo_user_ids:
        log.info("Wiping %d previously-seeded users…", len(demo_user_ids))
        db.execute(delete(Follow).where(Follow.follower_id.in_(demo_user_ids)))
        db.execute(delete(Follow).where(Follow.following_id.in_(demo_user_ids)))
        db.execute(delete(User).where(User.id.in_(demo_user_ids)))

    db.commit()


def seed_users(db) -> dict[str, User]:
    """Create all demo users and return a username → User map."""
    created: dict[str, User] = {}
    for spec in USERS:
        email = f"{spec['username']}{DEMO_EMAIL_SUFFIX}"
        avatar_url = upload_image(f"avatar-{spec['username']}", (256, 256))
        user = User(
            email=email,
            username=spec["username"],
            password_hash=hash_password(DEMO_PASSWORD),
            display_name=spec["display_name"],
            bio=spec["bio"],
            affiliations=spec["affiliations"],
            research_interests=spec["research_interests"],
            avatar_url=avatar_url,
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.flush()
        created[spec["username"]] = user
        log.info("  user %s (%s)", spec["username"], email)
    db.commit()
    return created


def seed_posts(db, users: dict[str, User]) -> list[Post]:
    """Create all demo posts. Each post uploads a cover + inline images first."""
    created: list[Post] = []
    now = datetime.now(timezone.utc)
    from slugify import slugify as _slugify

    for idx, spec in enumerate(POSTS):
        author = users[spec["author_username"]]
        cover_url = upload_image(spec["image_seed"])
        inline_urls: list[str] = []
        for seed in spec.get("inline_seeds", []):
            u = upload_image(seed, (1000, 600))
            if u:
                inline_urls.append(u)

        content = build_tiptap_content(
            paragraphs=spec["paragraphs"],
            inline_image_urls=inline_urls,
            code=spec.get("code"),
            quote=spec.get("quote"),
        )

        tags = list(spec["tags"]) + [DEMO_TAG]
        published_at = now - timedelta(days=idx, hours=random.randint(0, 20))
        base = _slugify(spec["title"], max_length=280)
        slug = f"{base}-{uuid.uuid4().hex[:8]}"

        post = Post(
            author_id=author.id,
            title=spec["title"],
            slug=slug,
            content=content,
            field=spec["field"],
            sub_field=spec.get("sub_field"),
            language=spec["language"],
            tags=tags,
            status=PostStatus.PUBLISHED,
            cover_image_url=cover_url,
            published_at=published_at,
            view_count=random.randint(25, 900),
        )
        db.add(post)
        db.flush()
        created.append(post)
        log.info("  post %-55s by %s", spec["title"][:55], spec["author_username"])
    db.commit()
    return created


def seed_interactions(db, users: dict[str, User], posts: list[Post]) -> None:
    """Create likes, bookmarks, follows so the for-you recommender has signal."""
    user_list = list(users.values())
    random.seed(42)

    like_count = bookmark_count = follow_count = 0

    for user in user_list:
        # Like ~6 posts by OTHER authors, preferring ones aligned to interests
        other_posts = [p for p in posts if p.author_id != user.id]
        interests = set(user.research_interests or [])
        scored = sorted(
            other_posts,
            key=lambda p: -sum(1 for t in (p.tags or []) if t in interests),
        )
        for post in scored[:6]:
            db.add(
                Interaction(
                    user_id=user.id,
                    post_id=post.id,
                    type=InteractionType.LIKE,
                )
            )
            post.like_count = (post.like_count or 0) + 1
            like_count += 1

        # Bookmark 2 aligned posts
        for post in scored[:2]:
            db.add(Bookmark(user_id=user.id, post_id=post.id))
            bookmark_count += 1

    # A sparse follow graph: each user follows 2 others
    for user in user_list:
        targets = random.sample([u for u in user_list if u.id != user.id], 2)
        for t in targets:
            db.add(Follow(follower_id=user.id, following_id=t.id))
            follow_count += 1

    db.commit()
    log.info(
        "  interactions: %d likes, %d bookmarks, %d follows",
        like_count,
        bookmark_count,
        follow_count,
    )


def trigger_ml(posts: list[Post]) -> None:
    """Queue embedding + CLIP tasks for every post via Celery."""
    from app.celery_app import celery_app
    from app.services.image_index import ensure_image_collection

    ensure_image_collection()

    for post in posts:
        try:
            celery_app.send_task("tasks.process_post_ml", args=[str(post.id)])
        except Exception as exc:  # noqa: BLE001
            log.warning("process_post_ml enqueue failed: %s", exc)

        # Queue CLIP embedding for the cover image (and any inline images)
        if post.cover_image_url:
            try:
                celery_app.send_task(
                    "tasks.embed_image",
                    kwargs={
                        "image_id": str(uuid.uuid5(uuid.NAMESPACE_URL, post.cover_image_url)),
                        "url": post.cover_image_url,
                        "uploader_id": str(post.author_id),
                        "post_id": str(post.id),
                        "content_type": "image/jpeg",
                        "alt_text": post.title,
                    },
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("embed_image enqueue failed: %s", exc)


def main() -> int:
    start = time.time()
    log.info("=== Blogify demo seed ===")

    with sync_session() as db:
        log.info("Step 1/5  wipe previous demo data")
        wipe_previous_demo_data(db)

        log.info("Step 2/5  seed %d users (this uploads avatars)…", len(USERS))
        users = seed_users(db)

        log.info("Step 3/5  seed %d posts (this uploads cover + inline images)…", len(POSTS))
        posts = seed_posts(db, users)

        log.info("Step 4/5  seed interactions")
        seed_interactions(db, users, posts)

    log.info("Step 5/5  enqueue ML pipeline tasks (embeddings + CLIP)")
    with sync_session() as db:
        # Re-fetch to get a fresh session
        posts = list(
            db.execute(
                select(Post).where(Post.tags.any(DEMO_TAG))
            ).scalars().all()
        )
        trigger_ml(posts)

    elapsed = time.time() - start
    log.info("")
    log.info("=== Done in %.1fs ===", elapsed)
    log.info("  %d users, %d posts", len(USERS), len(POSTS))
    log.info("  Login: <username>%s / %s", DEMO_EMAIL_SUFFIX, DEMO_PASSWORD)
    log.info("  Try: aria_nlp%s, marcus_bio%s, …", DEMO_EMAIL_SUFFIX, DEMO_EMAIL_SUFFIX)
    log.info("  ML tasks are running in Celery — embeddings + CLIP vectors will be ready in ~1-2 min.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
