import httpx
import pytest
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.core import supabase as supabase_module
from app import main
from app.core.config import settings
from app.core.database import engine
from app.models import SignupBonusGrant, User, Wallet, WalletTransaction
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

    monkeypatch.setattr(supabase_module.httpx, "get", fake_get)
    monkeypatch.setattr(supabase_module.jwt, "get_unverified_header", lambda _token: {"alg": "HS256"})
    deps.supabase_verifier._identities.clear()
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


def test_supabase_sync_missing_dob_is_profile_incomplete(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_provider", "supabase")
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "anon")
    monkeypatch.setattr(main, "supabase_identity", lambda _token: {"id": "google-new", "email": "new@example.com", "provider": "google"})

    response = client.post("/api/v1/auth/supabase-sync", json={}, headers={"Authorization": "Bearer valid"})

    assert response.status_code == 200
    assert response.json()["status"] == "profile_incomplete"
    assert response.json()["required_fields"] == ["date_of_birth"]


def test_supabase_sync_is_idempotent_and_bonus_event_only_once(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_provider", "supabase")
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "anon")
    monkeypatch.setattr(settings, "signup_bonus_gold", 100)
    monkeypatch.setattr(settings, "signup_bonus_silver", 50)
    monkeypatch.setattr(settings, "signup_bonus_enabled", True)
    monkeypatch.setattr(settings, "database_url", "sqlite:///sync_bonus_validation.db")
    monkeypatch.setattr(main, "supabase_identity", lambda _token: {"id": "google-once", "email": "once@example.com", "provider": "google"})

    first = client.post("/api/v1/auth/supabase-sync", json={"date_of_birth": "1990-01-01T00:00:00Z"}, headers={"Authorization": "Bearer valid"})
    second = client.post("/api/v1/auth/supabase-sync", json={"date_of_birth": "1990-01-01T00:00:00Z"}, headers={"Authorization": "Bearer valid"})

    assert first.status_code == 200
    assert first.json()["status"] == "ready"
    assert first.json()["bonus"]["granted_now"] is True
    assert second.status_code == 200
    assert second.json()["bonus"]["granted_now"] is False
    assert second.json()["bonus"]["already_granted"] is True
    assert first.json()["user"]["id"] == second.json()["user"]["id"]

    with Session(engine) as db:
        user = db.query(User).filter_by(auth_provider_id="google-once").one()
        assert db.query(SignupBonusGrant).filter_by(user_id=user.id).count() == 1
        assert db.query(WalletTransaction).filter_by(user_id=user.id, currency="gold", reason="signup_bonus").count() == 1
        assert db.query(WalletTransaction).filter_by(user_id=user.id, currency="silver", reason="signup_bonus").count() == 1


def test_supabase_suspended_user_is_403(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_provider", "supabase")
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "anon")
    monkeypatch.setattr(main, "supabase_identity", lambda _token: {"id": "suspended-provider", "email": "suspended@example.com", "provider": "google"})
    with Session(engine) as db:
        user = User(email="suspended@example.com", password_hash="x", date_of_birth=datetime(1990, 1, 1), age_verified=True, auth_provider="google", auth_provider_id="suspended-provider", account_status="suspended")
        db.add(user)
        db.flush()
        db.add(Wallet(user_id=user.id))
        db.commit()

    response = client.post("/api/v1/auth/supabase-sync", json={}, headers={"Authorization": "Bearer valid"})

    assert response.status_code == 403
