from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.metrics import record_metric
from app.core.security import decode_subject
from app.core.supabase import supabase_verifier
from app.models import User

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


def supabase_identity(token: str) -> dict[str, object] | None:
    return supabase_verifier.verify(token)


def current_user(token: str | None = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if settings.effective_auth_provider == "supabase":
        identity = supabase_identity(token)
        if not identity:
            record_metric("supabase_verification_failures")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
        user = db.scalar(select(User).where(User.auth_provider_id == str(identity["id"])))
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase identity is not linked")
    else:
        try:
            user_id = int(decode_subject(token))
            user = db.get(User, user_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized") from None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if user.account_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended")
    return user


def verified_user(user: User = Depends(current_user)) -> User:
    if not user.age_verified:
        raise HTTPException(status_code=403, detail="Age verification required")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin" and user.email.lower() not in settings.configured_admin_emails:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user
