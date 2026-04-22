"""Seed an admin user. Idempotent: promotes existing user or creates new one."""

import asyncio
import os
import sys

from sqlalchemy import select

sys.path.insert(0, "/app")

from app.auth.utils import hash_password
from app.database import async_session
from app.models import user as _user_m  # noqa: F401
from app.models import post as _post_m  # noqa: F401
from app.models import comment as _comment_m  # noqa: F401
from app.models import interaction as _interaction_m  # noqa: F401
from app.models import notification as _notification_m  # noqa: F401
from app.models import ad as _ad_m  # noqa: F401
from app.models.user import User


async def main() -> None:
    email = os.getenv("ADMIN_EMAIL", "admin@blogify.com")
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "admin123")
    display_name = os.getenv("ADMIN_DISPLAY_NAME", "Administrator")

    async with async_session() as session:
        existing = await session.scalar(select(User).where(User.email == email))
        if existing:
            existing.is_admin = True
            existing.is_active = True
            await session.commit()
            print(f"Promoted existing user to admin: {existing.email} (username={existing.username})")
            return

        user = User(
            email=email,
            username=username,
            password_hash=hash_password(password),
            display_name=display_name,
            is_admin=True,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        print(f"Created admin user: {user.email} (username={user.username})")
        print(f"Password: {password}")


if __name__ == "__main__":
    asyncio.run(main())
