from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import main
from app.main import app
from .conftest import auth


ALLOWED_ORIGIN = "https://field-yield.vercel.app"


def test_production_origin_is_allowed(client):
    response = client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_localhost_origin_is_blocked(client):
    response = client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_protected_route_unauthorized_response_keeps_cors_headers(client):
    response = client.get(
        "/api/v1/users/me",
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"
    assert response.json()["request_id"]
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_invalid_login_is_401_and_keeps_cors_headers(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "wrong-password"},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"
    assert response.json()["request_id"]
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_valid_login_and_protected_route_keep_cors_headers(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "cors-user@example.com",
            "password": "password123",
            "date_of_birth": "1990-01-01T00:00:00Z",
        },
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "cors-user@example.com", "password": "password123"},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    response = client.get(
        "/api/v1/users/me",
        headers={"Origin": ALLOWED_ORIGIN, "Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_preflight_for_auth_protected_routes_succeeds_before_auth(client):
    response = client.options(
        "/api/v1/users/me",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_validation_forbidden_and_rate_limit_responses_keep_cors_headers(client, monkeypatch):
    invalid = client.post(
        "/api/v1/auth/register",
        json={},
        headers={"Origin": ALLOWED_ORIGIN},
    )
    assert invalid.status_code == 422
    assert invalid.headers["access-control-allow-origin"] == ALLOWED_ORIGIN

    headers = auth(client) | {"Origin": ALLOWED_ORIGIN}
    forbidden = client.get("/api/v1/admin/users", headers=headers)
    assert forbidden.status_code == 403
    assert forbidden.headers["access-control-allow-origin"] == ALLOWED_ORIGIN

    monkeypatch.setattr(
        main,
        "enforce_rate_limit",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            HTTPException(429, "Too many requests; retry later", headers={"Retry-After": "60"})
        ),
    )
    limited = client.get("/api/v1/market/prices", headers={"Origin": ALLOWED_ORIGIN})
    assert limited.status_code == 429
    assert limited.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert limited.headers["retry-after"] == "60"


def test_unhandled_error_response_is_redacted_and_keeps_cors_headers(client, monkeypatch):
    headers = auth(client) | {"Origin": ALLOWED_ORIGIN}
    monkeypatch.setattr(main, "_portfolio_totals", lambda *_args: (_ for _ in ()).throw(RuntimeError("sensitive detail")))

    with TestClient(app, raise_server_exceptions=False) as isolated_client:
        response = isolated_client.get("/api/v1/portfolio", headers=headers)

    assert response.status_code == 500
    assert response.json()["detail"] == "Internal Server Error"
    assert "sensitive detail" not in response.text
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
