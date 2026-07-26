from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_subject
from app.core.config import settings
from app.models import User

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def supabase_identity(token: str) -> dict[str, object] | None:
    if not token or not settings.supabase_url or not settings.supabase_anon_key:
        return None
    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
            timeout=3,
        )
        if not response.is_success:
            return None
        payload = response.json()
        if not isinstance(payload, dict) or not payload.get("id") or not payload.get("email"):
            return None
        app_metadata = payload.get("app_metadata")
        providers = app_metadata.get("providers") if isinstance(app_metadata, dict) else None
        identities = payload.get("identities")
        if not isinstance(providers, list) and isinstance(identities, list):
            providers = [identity.get("provider") for identity in identities if isinstance(identity, dict)]
        provider = "supabase"
        if isinstance(providers, list):
            if "google" in providers:
                provider = "google"
            elif "email" in providers:
                provider = "email"
        return {"id": str(payload["id"]), "email": str(payload["email"]).lower(), "provider": provider}
    except (httpx.HTTPError, ValueError):
        return None

def current_user(token: str | None = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if settings.effective_auth_provider == "supabase":
        identity = supabase_identity(token)
        if not identity:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
        user = db.scalar(select(User).where(User.auth_provider_id == str(identity["id"])))
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase identity is not linked")
    else:
        try:
            user_id = int(decode_subject(token))
            user = db.get(User, user_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if not user: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if user.account_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended")
    return user

def verified_user(user: User = Depends(current_user)) -> User:
    if not user.age_verified: raise HTTPException(status_code=403, detail="Age verification required")
    return user

def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin" and user.email.lower() not in settings.configured_admin_emails:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user
