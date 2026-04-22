import uuid
from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    payload: dict
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
