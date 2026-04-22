import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    affiliations: str | None = None
    research_interests: list[str] | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    display_name: str
    bio: str | None = None
    avatar_url: str | None = None
    affiliations: str | None = None
    research_interests: list[str] | None = None
    is_active: bool
    is_admin: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    bio: str | None = None
    avatar_url: str | None = None
    affiliations: str | None = None
    research_interests: list[str] | None = None
    created_at: datetime
    follower_count: int = 0
    following_count: int = 0
    post_count: int = 0
    is_following: bool = False

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
