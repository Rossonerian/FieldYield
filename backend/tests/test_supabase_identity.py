import httpx
import pytest
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.core.database import engine
from app.models import User, Wallet
from app.services import sync_supabase_user


def test_supabase_identity_extracts_provider_without_trusting_client_claims(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "anon")

    def fake_get(*_args, **_kwargs):
        return httpx.Response(
            200,
            json={"id": "google-user", "email": "user@example.com", "app_metadata": {"providers": ["google"]}},
            request=httpx.Request("GET", "https://project.supabase.co/auth/v1/user"),
        )

    monkeypatch.setattr(deps.httpx, "get", fake_get)
    assert deps.supabase_identity("supabase-token") == {"id": "google-user", "email": "user@example.com", "provider": "google"}


def test_supabase_sync_does_not_merge_by_email_only(client):
    with Session(engine) as db:
        existing = User(email="existing@example.com", password_hash="local", date_of_birth=datetime(1990, 1, 1), age_verified=True)
        db.add(existing)
        db.flush()
        db.add(Wallet(user_id=existing.id))
        db.commit()
        with pytest.raises(HTTPException) as error:
            sync_supabase_user(db, provider_id="new-provider-id", provider="google", email="existing@example.com", date_of_birth=datetime(1990, 1, 1))
        assert error.value.status_code == 409
