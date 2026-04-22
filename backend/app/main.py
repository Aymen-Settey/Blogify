from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, posts, interactions, social, uploads, notifications, recommendations, ads, bookmarks, ai, search_images
from app.services.metrics import PrometheusMiddleware, metrics_endpoint

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered research blogging platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(PrometheusMiddleware)

app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(interactions.router)
app.include_router(social.router)
app.include_router(uploads.router)
app.include_router(notifications.router)
app.include_router(recommendations.router)
app.include_router(ads.router)
app.include_router(bookmarks.router)
app.include_router(ai.router)
app.include_router(search_images.router)

app.add_route("/metrics", metrics_endpoint)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}
