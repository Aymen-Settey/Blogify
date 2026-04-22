from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "blogify",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

# Import task modules so Celery registers them. `autodiscover_tasks` alone
# looks for `<pkg>.tasks` which doesn't match our layout (`app.tasks.ml_tasks`).
from app.tasks import ml_tasks  # noqa: E402,F401

celery_app.autodiscover_tasks(["app.tasks"])
