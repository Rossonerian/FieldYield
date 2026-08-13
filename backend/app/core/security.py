from datetime import datetime, timedelta, timezone

import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext

from app.core.config import settings

LOCAL_JWT_ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(subject: str) -> str:
    issued_at = datetime.now(timezone.utc)
    expires = issued_at + timedelta(minutes=settings.access_token_expire_minutes)
    claims = {
        "sub": subject,
        "iat": issued_at,
        "exp": expires,
        "iss": settings.local_jwt_issuer,
        "aud": settings.local_jwt_audience,
    }
    return jwt.encode(claims, settings.secret_key, algorithm=LOCAL_JWT_ALGORITHM)


def decode_subject(token: str) -> str:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[LOCAL_JWT_ALGORITHM],
            audience=settings.local_jwt_audience,
            issuer=settings.local_jwt_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject:
            raise ValueError("Invalid token")
        return subject
    except (InvalidTokenError, ValueError, TypeError) as exc:
        raise ValueError("Invalid token") from exc
