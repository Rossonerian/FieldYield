from __future__ import annotations

import threading
import time
from hashlib import sha256
from dataclasses import dataclass

import httpx
import jwt
from jwt.exceptions import InvalidTokenError

from app.core.config import settings


@dataclass
class _CacheEntry:
    value: object
    expires_at: float


class SupabaseVerifier:
    def __init__(self) -> None:
        self._jwks: _CacheEntry | None = None
        self._identities: dict[str, _CacheEntry] = {}
        self._lock = threading.Lock()

    @property
    def issuer(self) -> str:
        return f"{(settings.supabase_url or '').rstrip('/')}/auth/v1"

    def _provider(self, payload: dict[str, object]) -> str:
        app_metadata = payload.get("app_metadata")
        providers = app_metadata.get("providers") if isinstance(app_metadata, dict) else None
        identities = payload.get("identities")
        if not isinstance(providers, list) and isinstance(identities, list):
            providers = [item.get("provider") for item in identities if isinstance(item, dict)]
        if isinstance(providers, list) and "google" in providers:
            return "google"
        if isinstance(providers, list) and "email" in providers:
            return "email"
        return "supabase"

    def _identity(self, payload: dict[str, object]) -> dict[str, object] | None:
        subject = payload.get("sub") or payload.get("id")
        email = payload.get("email")
        if not isinstance(subject, str) or not subject or not isinstance(email, str) or not email:
            return None
        return {"id": subject, "email": email.lower(), "provider": self._provider(payload)}

    def _get_jwks(self, *, force: bool = False) -> dict[str, object] | None:
        current_time = time.monotonic()
        with self._lock:
            if not force and self._jwks and self._jwks.expires_at > current_time:
                return self._jwks.value if isinstance(self._jwks.value, dict) else None
        try:
            response = httpx.get(
                f"{self.issuer}/.well-known/jwks.json",
                headers={"apikey": settings.supabase_anon_key or ""},
                timeout=settings.supabase_http_timeout_seconds,
            )
            if not response.is_success:
                return None
            payload = response.json()
            if not isinstance(payload, dict) or not isinstance(payload.get("keys"), list):
                return None
        except (httpx.HTTPError, ValueError):
            return None
        with self._lock:
            self._jwks = _CacheEntry(payload, current_time + settings.supabase_jwks_cache_seconds)
        return payload

    def _verify_asymmetric(self, token: str, algorithm: str, kid: str) -> dict[str, object] | None:
        if algorithm not in {"RS256", "ES256"} or not kid:
            return None
        for refresh in (False, True):
            jwks = self._get_jwks(force=refresh)
            keys = jwks.get("keys", []) if jwks else []
            key = next((item for item in keys if isinstance(item, dict) and item.get("kid") == kid), None)
            if key:
                try:
                    payload = jwt.decode(
                        token,
                        jwt.PyJWK.from_dict(key, algorithm=algorithm),
                        algorithms=[algorithm],
                        audience=settings.supabase_jwt_audience,
                        issuer=self.issuer,
                        options={"require": ["exp", "sub", "iat"]},
                    )
                    return payload if isinstance(payload, dict) else None
                except (InvalidTokenError, ValueError, TypeError):
                    return None
        return None

    def _remote_identity(self, token: str) -> dict[str, object] | None:
        current_time = time.monotonic()
        cache_key = sha256(token.encode()).hexdigest()
        with self._lock:
            cached = self._identities.get(cache_key)
            if cached and cached.expires_at > current_time:
                return cached.value if isinstance(cached.value, dict) else None
            if len(self._identities) > 1024:
                self._identities = {key: value for key, value in self._identities.items() if value.expires_at > current_time}
        try:
            response = httpx.get(
                f"{self.issuer}/user",
                headers={"apikey": settings.supabase_anon_key or "", "Authorization": f"Bearer {token}"},
                timeout=settings.supabase_http_timeout_seconds,
            )
            payload = response.json() if response.is_success else None
            identity = self._identity(payload) if isinstance(payload, dict) else None
        except (httpx.HTTPError, ValueError):
            identity = None
        if identity:
            with self._lock:
                self._identities[cache_key] = _CacheEntry(identity, current_time + settings.supabase_remote_cache_seconds)
        return identity

    def verify(self, token: str) -> dict[str, object] | None:
        if not token or not settings.supabase_configured:
            return None
        try:
            header = jwt.get_unverified_header(token)
        except InvalidTokenError:
            return None
        algorithm = header.get("alg") if isinstance(header, dict) else None
        kid = header.get("kid") if isinstance(header, dict) else None
        if isinstance(algorithm, str) and isinstance(kid, str):
            payload = self._verify_asymmetric(token, algorithm, kid)
            if payload is not None:
                return self._identity(payload)
            if algorithm in {"RS256", "ES256"}:
                return None
        # Legacy Supabase HS256 projects cannot expose the signing secret to
        # this API. Verify them remotely with a short timeout and bounded cache.
        if algorithm == "HS256":
            return self._remote_identity(token)
        return None


supabase_verifier = SupabaseVerifier()
