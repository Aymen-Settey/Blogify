from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File, status

from app.config import get_settings
from app.models.user import User
from app.auth.utils import get_current_user
from app.services.storage import upload_file

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_PDF_TYPES = {"application/pdf"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_PDF_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    alt_text: str | None = Form(None),
    post_id: str | None = Form(None),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type")

    data = await file.read()
    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    url = upload_file(data, file.filename or "image", file.content_type)

    # Enqueue CLIP embedding so the image becomes searchable. The endpoint
    # returns immediately; the worker handles heavy model work async.
    image_id: str | None = None
    if get_settings().IMAGE_SEARCH_ENABLED:
        import uuid as _uuid

        image_id = str(_uuid.uuid4())
        try:
            from app.tasks.ml_tasks import embed_image

            embed_image.delay(
                image_id=image_id,
                url=url,
                uploader_id=str(current_user.id),
                post_id=post_id,
                content_type=file.content_type,
                alt_text=alt_text,
            )
        except Exception:  # noqa: BLE001
            # Celery outage shouldn't break uploads — searchability is best-effort.
            image_id = None

    return {"url": url, "image_id": image_id}


@router.post("/pdf", status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=400, detail="Invalid PDF type")

    data = await file.read()
    if len(data) > MAX_PDF_SIZE:
        raise HTTPException(status_code=400, detail="PDF too large (max 50MB)")

    url = upload_file(data, file.filename or "file.pdf", file.content_type)
    return {"url": url}
