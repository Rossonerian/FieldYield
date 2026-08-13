import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from app.core.config import settings
from app.core.supabase import SupabaseVerifier


@pytest.fixture()
def asymmetric_verifier(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "anon")
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk.update({"kid": "test-key", "alg": "RS256", "use": "sig"})
    verifier = SupabaseVerifier()
    monkeypatch.setattr(verifier, "_get_jwks", lambda *, force=False: {"keys": [jwk]})
    return verifier, private_key


def _token(verifier, private_key, **overrides):
    issued_at = datetime.now(timezone.utc)
    claims = {
        "sub": "provider-user",
        "email": "User@Example.com",
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=5),
        "iss": verifier.issuer,
        "aud": settings.supabase_jwt_audience,
        "app_metadata": {"providers": ["google"]},
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})


def test_asymmetric_supabase_token_validates_required_claims_and_provider(asymmetric_verifier):
    verifier, private_key = asymmetric_verifier

    assert verifier.verify(_token(verifier, private_key)) == {
        "id": "provider-user",
        "email": "user@example.com",
        "provider": "google",
    }


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "wrong-audience"},
        {"iss": "https://wrong.example/auth/v1"},
        {"exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        {"email": None},
        {"sub": None},
    ],
)
def test_asymmetric_supabase_token_rejects_invalid_claims(asymmetric_verifier, overrides):
    verifier, private_key = asymmetric_verifier

    assert verifier.verify(_token(verifier, private_key, **overrides)) is None


def test_supabase_verifier_rejects_unknown_key_and_malformed_token(asymmetric_verifier):
    verifier, private_key = asymmetric_verifier
    unknown_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    unknown = jwt.encode(
        jwt.decode(_token(verifier, private_key), options={"verify_signature": False}),
        unknown_key,
        algorithm="RS256",
        headers={"kid": "unknown-key"},
    )

    assert verifier.verify(unknown) is None
    assert verifier.verify("not-a-jwt") is None


def test_oauth_form_login_is_case_insensitive_after_multipart_upgrade(client):
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": "Mixed.Case@Example.com",
            "password": "password123",
            "date_of_birth": "1990-01-01T00:00:00Z",
        },
    )
    assert registration.status_code == 200

    response = client.post(
        "/api/v1/auth/token",
        data={"username": "MIXED.CASE@EXAMPLE.COM", "password": "password123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
